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

// --- FUNÇÕES DAS FERRAMENTAS DA IA ---

async function getSystemInstruction(supabase) {
    const { data, error } = await supabase.from('configuracoes_ia').select('system_prompt').eq('nome', 'stella_whatsapp').single();
    if (error || !data) {
        console.error("ERRO: Não foi possível buscar as instruções da IA. Usando prompt padrão.", error);
        return 'Você é a Stella, uma assistente virtual. Responda de forma amigável e direta.';
    }
    return data.system_prompt;
}

async function criar_atividade(supabase, { titulo, descricao }, contatoId, empreendimentoId, usuarioId) {
    const { data, error } = await supabase.from('activities').insert({ nome: titulo, descricao: `[TAREFA CRIADA PELA IA STELLA]\n${descricao}\n\nAssociada ao contato ID: ${contactId || 'Não informado'}`, empreendimento_id: empreendimentoId, criado_por_usuario_id: usuarioId, status: 'Não iniciado' }).select().single();
    if (error) {
        console.error("Erro ao criar atividade:", error);
        return "Tive um problema ao tentar agendar sua solicitação. Por favor, informe a um de nossos atendentes.";
    }
    return `Entendido! Agendei a seguinte tarefa para nossa equipe: "${titulo}". Entraremos em contato! 👍`;
}

async function buscar_em_documentos(supabase, { termo_busca }, empreendimentoId) {
    if (!empreendimentoId) return "Com certeza! Para eu buscar essa informação, sobre qual empreendimento estamos falando?";
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await embeddingModel.embedContent(termo_busca);
    const embedding = result.embedding.values;
    const { data: chunks, error } = await supabase.rpc('match_documento_empreendimento', { query_embedding: embedding, match_threshold: 0.7, match_count: 5, p_empreendimento_id: empreendimentoId });
    if (error || !chunks || chunks.length === 0) return "Não encontrei informações sobre isso nos documentos do empreendimento. Um de nossos consultores irá verificar e entrar em contato em breve.";
    const contextText = chunks.map(c => c.content).join('\n---\n');
    const finalAnswerPrompt = `Com base nestes trechos de documentos, responda de forma concisa à pergunta: "${termo_busca}"\n\nCONTEXTO:\n${contextText}`;
    const finalAnswerModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
    const finalAnswerResult = await finalAnswerModel.generateContent(finalAnswerPrompt);
    return finalAnswerResult.response.text();
}

async function enviar_anexo_cliente(supabase, { nome_arquivo_solicitado }, empreendimentoId, senderPhone, contactId, config) {
    if (!empreendimentoId) return "Por favor, primeiro me diga sobre qual empreendimento você gostaria de receber o arquivo.";
    const { data: anexo, error } = await supabase.from('empreendimento_anexos').select('caminho_arquivo, nome_arquivo').eq('empreendimento_id', empreendimentoId).eq('pode_enviar_anexo', true).ilike('nome_arquivo', `%${nome_arquivo_solicitado}%`).limit(1).single();
    if (error || !anexo) {
        console.error("Erro ao buscar anexo para envio:", error);
        return `Não encontrei um arquivo com o nome parecido com "${nome_arquivo_solicitado}" que eu possa enviar. Você pode tentar pedir de outra forma?`;
    }
    const { data: urlData } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(anexo.caminho_arquivo, 300);
    if (!urlData?.signedUrl) return "Tive um problema para gerar o link do arquivo. Por favor, peça a um de nossos atendentes.";
    
    await sendMediaMessage(supabase, config, senderPhone, contactId, urlData.signedUrl, anexo.nome_arquivo, `Aqui está o ${anexo.nome_arquivo} que você pediu!`);
    
    return `Estou enviando o arquivo "${anexo.nome_arquivo}" para você agora mesmo! 😊`;
}

// --- FUNÇÕES DE COMUNICAÇÃO COM WHATSAPP ---

async function sendTextMessage(supabase, config, to, contactId, text) {
    if (!text || text.trim() === "") return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mensagem de texto via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contactId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: text, direction: 'outbound', status: 'sent', raw_payload: payload });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mensagem de texto:", error); }
}

async function sendMediaMessage(supabase, config, to, contactId, publicUrl, fileName, caption) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "document", document: { link: publicUrl, filename: fileName, caption: caption } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mídia via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contactId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: caption, direction: 'outbound', status: 'sent', raw_payload: payload });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mídia:", error); }
}

// --- LÓGICA PRINCIPAL (O MOTOR DE RACIOCÍNIO) - VERSÃO CORRIGIDA ---
async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    const systemInstruction = await getSystemInstruction(supabase);

    const generativeModel = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-latest",
        safetySettings,
        systemInstruction: systemInstruction,
        tools: {
            functionDeclarations: [
                { name: "criar_atividade", description: "Cria uma nova tarefa ou atividade no sistema.", parameters: { type: "OBJECT", properties: { titulo: { type: "STRING" }, descricao: { type: "STRING" } }, required: ["titulo", "descricao"] } },
                { name: "buscar_em_documentos", description: "Busca informações específicas nos documentos de um empreendimento.", parameters: { type: "OBJECT", properties: { termo_busca: { type: "STRING" } }, required: ["termo_busca"] } },
                { name: "enviar_anexo_cliente", description: "Envia um arquivo para o cliente.", parameters: { type: "OBJECT", properties: { nome_arquivo_solicitado: { type: "STRING" } }, required: ["nome_arquivo_solicitado"] } }
            ]
        }
    });

    // CORREÇÃO APLICADA AQUI: Lógica de contexto aprimorada
    let context = await getConversationContext(supabase, senderPhone);
    let empreendimentoId = context.empreendimentoId;

    // 1. Verifica se o empreendimento já é conhecido
    if (!empreendimentoId) {
        const texto = messageText.toLowerCase();
        const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');
        const empreendimentoEncontrado = empreendimentos?.find(emp => texto.includes(emp.nome.toLowerCase()));

        // 2. Se encontrou o nome do empreendimento na mensagem do cliente...
        if (empreendimentoEncontrado) {
            console.log(`[CONTEXTO] Empreendimento ID ${empreendimentoEncontrado.id} identificado e salvo para ${senderPhone}.`);
            empreendimentoId = empreendimentoEncontrado.id;
            // 3. ...salva o contexto IMEDIATAMENTE.
            context = { empreendimentoId, empreendimentoNome: empreendimentoEncontrado.nome };
            await saveConversationContext(supabase, senderPhone, context);
        }
    }
    
    // O histórico é construído DEPOIS que o contexto foi potencialmente atualizado.
    const { data: messages } = await supabase.from('whatsapp_messages').select('content, direction').eq('receiver_id', senderPhone).or(`sender_id.eq.${senderPhone}`).order('sent_at', { ascending: false }).limit(20);
    const chatHistory = messages ? messages.reverse().map(msg => ({ role: msg.direction === 'inbound' ? 'user' : 'model', parts: [{ text: msg.content || "" }] })) : [];
    
    const chat = generativeModel.startChat({ history: chatHistory });
    const result = await chat.sendMessage(messageText);
    const response = result.response;
    const functionCalls = response.functionCalls();

    let respostaFinal;

    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'criar_atividade') {
            const stellaUserId = 'b265268e-4493-40b7-9862-0bff34dd6799';
            respostaFinal = await criar_atividade(supabase, call.args, contactId, empreendimentoId, stellaUserId);
        } else if (call.name === 'buscar_em_documentos') {
            respostaFinal = await buscar_em_documentos(supabase, call.args, empreendimentoId);
        } else if (call.name === 'enviar_anexo_cliente') {
            respostaFinal = await enviar_anexo_cliente(supabase, call.args, empreendimentoId, senderPhone, contactId, config);
        } else {
            respostaFinal = "Entendi que preciso fazer algo, mas não tenho a ferramenta certa para isso no momento.";
        }
    } else {
        respostaFinal = response.text();
    }

    // A resposta final (texto) é enviada após a lógica
    await sendTextMessage(supabase, config, senderPhone, contactId, respostaFinal);
    // O contexto é salvo mais uma vez para garantir consistência
    await saveConversationContext(supabase, senderPhone, context);
}

// --- FUNÇÕES AUXILIARES E WEBHOOK (Sem grandes alterações) ---
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
    if (!digitsOnly.startsWith('55')) { numbersToSearch.add('55' + digitsOnly); }
    return Array.from(numbersToSearch);
}

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
            return NextResponse.json({ status: 'error', message: 'Configuração do WhatsApp ausente.' }, { status: 500 });
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
            
            if (messageContent) {
                await processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}