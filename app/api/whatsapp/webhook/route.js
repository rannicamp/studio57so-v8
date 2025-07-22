import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const generativeModel = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    safetySettings,
    tools: {
        functionDeclarations: [
            {
                name: "criar_atividade",
                description: "Cria uma nova tarefa ou atividade no sistema quando o cliente pedir para ser lembrado de algo, agendar um contato futuro ou solicitar uma ação que não pode ser resolvida imediatamente.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        titulo: { type: "STRING", description: "Um título curto e direto para a tarefa. Ex: 'Ligar para o cliente João'" },
                        descricao: { type: "STRING", description: "Uma descrição detalhada do que precisa ser feito, incluindo o nome do cliente e o que ele pediu. Ex: 'Cliente pediu para avisar quando a unidade 101 do Residencial Alfa estiver disponível.'" },
                        data_vencimento: { type: "STRING", description: "A data para a qual a tarefa deve ser agendada, no formato AAAA-MM-DD." }
                    },
                    required: ["titulo", "descricao"]
                }
            },
            {
                name: "buscar_em_documentos",
                description: "Busca informações específicas dentro dos documentos (memoriais descritivos, books de venda, etc.) de um empreendimento para responder a perguntas detalhadas do cliente.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        termo_busca: { type: "STRING", description: "A pergunta exata ou o termo que deve ser buscado nos documentos. Ex: 'material do piso da sala' ou 'vaga de garagem coberta'" }
                    },
                    required: ["termo_busca"]
                }
            }
        ]
    }
});

// --- FUNÇÕES DAS FERRAMENTAS ---

async function criar_atividade(supabase, { titulo, descricao }, contatoId, empreendimentoId, usuarioId) {
    const { data, error } = await supabase.from('activities').insert({
        nome: titulo,
        descricao: `[TAREFA CRIADA PELA IA STELLA]\n${descricao}\n\nAssociada ao contato ID: ${contatoId || 'Não informado'}`,
        empreendimento_id: empreendimentoId,
        criado_por_usuario_id: usuarioId,
        status: 'Não iniciado'
    }).select().single();

    if (error) {
        console.error("Erro ao criar atividade:", error);
        return "Tive um problema ao tentar agendar sua solicitação. Por favor, informe a um de nossos atendentes.";
    }
    return `Entendido! Agendei a seguinte tarefa para nossa equipe: "${titulo}". Entraremos em contato! 👍`;
}

async function buscar_em_documentos(supabase, { termo_busca }, empreendimentoId) {
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await embeddingModel.embedContent(termo_busca);
    const embedding = result.embedding.values;

    const { data: chunks, error } = await supabase.rpc('match_documento_empreendimento', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        p_empreendimento_id: empreendimentoId
    });

    if (error || !chunks || chunks.length === 0) {
        return "Não encontrei informações sobre isso nos documentos do empreendimento.";
    }

    const contextText = chunks.map(c => c.content).join('\n---\n');
    const finalAnswerPrompt = `Com base nestes trechos de documentos, responda de forma concisa à pergunta: "${termo_busca}"\n\nCONTEXTO:\n${contextText}`;
    
    const finalAnswerResult = await generativeModel.generateContent(finalAnswerPrompt);
    return finalAnswerResult.response.text();
}

// --- FUNÇÕES AUXILIARES DE WHATSAPP ---

async function sendTextMessage(supabase, config, to, contactId, text) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mensagem via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({
                contato_id: contactId, message_id: messageId, sender_id: config.whatsapp_phone_number_id,
                receiver_id: to, content: text, sent_at: new Date().toISOString(),
                direction: 'outbound', status: 'sent', raw_payload: payload
            });
        }
    } catch (error) {
        console.error("ERRO de rede ao enviar mensagem via WhatsApp:", error);
    }
}

async function getConversationContext(supabase, phoneNumber) {
    const { data } = await supabase.from('whatsapp_conversations').select('context').eq('phone_number', phoneNumber).single();
    return data?.context || {};
}

async function saveConversationContext(supabase, phoneNumber, context) {
    await supabase.from('whatsapp_conversations').upsert({ phone_number: phoneNumber, context, updated_at: new Date().toISOString() });
}

function getTextContent(message) {
    if (!message || !message.type) { return null; }
    switch (message.type) {
        case 'text': return message.text?.body || null;
        case 'interactive':
            if (message.interactive?.button_reply) return message.interactive.button_reply.title;
            if (message.interactive?.list_reply) return message.interactive.list_reply.title;
            return null;
        default: return null;
    }
}

function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let numbersToSearch = new Set([digitsOnly]);
    const brazilDDI = '55';
    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === 10 || digitsOnly.length === 11) numbersToSearch.add(brazilDDI + digitsOnly);
    }
    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        if (remainingDigits.startsWith('9')) numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        numbersToSearch.add(ddiDdd + '9' + remainingDigits);
    }
    return Array.from(numbersToSearch);
}

// --- LÓGICA PRINCIPAL (O MOTOR DE RACIOCÍNIO) ---

async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    let context = await getConversationContext(supabase, senderPhone);
    let empreendimentoId = context.empreendimentoId;

    if (!empreendimentoId) {
        const texto = messageText.toLowerCase();
        const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');
        for (const emp of empreendimentos || []) {
            if (texto.includes(emp.nome.toLowerCase())) {
                empreendimentoId = emp.id;
                context = { empreendimentoId, empreendimentoNome: emp.nome };
                await saveConversationContext(supabase, senderPhone, context);
                break;
            }
        }
    }
    
    if (!empreendimentoId) {
        await sendTextMessage(supabase, config, senderPhone, contactId, "Olá! Sou a Stella. Para que eu possa te ajudar, por favor, me diga o nome do empreendimento sobre o qual deseja informações. 😊");
        return;
    }
    
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('content, direction')
        .eq('sender_id', senderPhone)
        .order('sent_at', { ascending: false })
        .limit(20);

    const chatHistory = messages ? messages.reverse().map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'model',
        parts: [{ text: msg.content || "" }]
    })) : [];
    
    const chat = generativeModel.startChat({ history: chatHistory });
    const result = await chat.sendMessage(messageText);
    const response = result.response;
    const functionCalls = response.functionCalls();

    let respostaFinal;

    if (functionCalls && functionCalls.length > 0) {
        console.log("[STELLA] Decidiu usar a ferramenta:", functionCalls[0].name);
        
        const call = functionCalls[0];
        if (call.name === 'criar_atividade') {
            const stellaUserId = 'b265268e-4493-40b7-9862-0bff34dd6799';
            respostaFinal = await criar_atividade(supabase, call.args, contactId, empreendimentoId, stellaUserId);
        } else if (call.name === 'buscar_em_documentos') {
            respostaFinal = await buscar_em_documentos(supabase, call.args, empreendimentoId);
        } else {
            respostaFinal = "Entendi que preciso fazer algo, mas não tenho a ferramenta certa para isso no momento.";
        }
    } else {
        console.log("[STELLA] Decidiu responder diretamente.");
        respostaFinal = response.text();
    }

    await sendTextMessage(supabase, config, senderPhone, contactId, respostaFinal);
    await saveConversationContext(supabase, senderPhone, context);
}

// --- WEBHOOK ---

export async function GET(request) {
    const searchParams = new URL(request.url).searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').limit(1).single();
        if (!whatsappConfig) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp não encontradas.");
            return new NextResponse(null, { status: 200 });
        }
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contactId = null;
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones?.length > 0) contactId = matchingPhones[0].contato_id;
            
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contactId, message_id: messageEntry.id, sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id, content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: messageEntry,
            });
            
            if (messageContent && (messageEntry.type === 'text' || messageEntry.type === 'interactive')) {
                processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
        }
        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}