import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


// --- FUNÇÕES AUXILIARES DE WHATSAPP (Sem alterações) ---
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

// --- FUNÇÕES DA IA STELLA ---

async function sendTextMessage(supabase, config, to, contactId, text) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
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
}

async function getConversationContext(supabase, phoneNumber) {
    const { data } = await supabase.from('whatsapp_conversations').select('context').eq('phone_number', phoneNumber).single();
    return data?.context || {};
}
async function saveConversationContext(supabase, phoneNumber, context) {
    await supabase.from('whatsapp_conversations').upsert({ phone_number: phoneNumber, context, updated_at: new Date().toISOString() });
}

async function answerQuestionBasedOnMemory(supabase, empreendimentoId, userQuestion) {
    const questionEmbeddingResult = await embeddingModel.embedContent(userQuestion);
    const questionEmbedding = questionEmbeddingResult.embedding.values;
    const { data: contextChunks, error: matchError } = await supabase
        .rpc('match_documento_empreendimento', {
            query_embedding: questionEmbedding,
            match_threshold: 0.75,
            match_count: 5,
            p_empreendimento_id: empreendimentoId
        });
    if (matchError) { console.error("[STELLA] Erro ao buscar na memória:", matchError); return "Tive um problema para acessar minhas memórias. Por favor, tente novamente."; }
    if (!contextChunks || contextChunks.length === 0) { return "Peço desculpas, mas não encontrei informações sobre isso nos meus documentos. Você poderia perguntar de outra forma?"; }
    const contextText = contextChunks.map(chunk => chunk.content).join("\n\n---\n\n");
    const prompt = `Você é a Stella, uma assistente especialista em imóveis. Use o CONTEXTO abaixo, que foi extraído dos documentos oficiais do empreendimento, para responder à PERGUNTA do cliente. Responda de forma clara, amigável e direta. Se a resposta não estiver no contexto, diga que não encontrou a informação. NÃO invente respostas. --- CONTEXTO --- ${contextText} --- FIM DO CONTEXTO --- PERGUNTA: "${userQuestion}"`;
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

// ***** INÍCIO DA LÓGICA CORRIGIDA *****
// O CÉREBRO DA STELLA (LÓGICA PRINCIPAL ATUALIZADA)
async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    const texto = messageText.toLowerCase();
    
    let context = await getConversationContext(supabase, senderPhone);
    let empreendimentoId = context.empreendimentoId;
    let empreendimentoNome = context.empreendimentoNome;

    // 1. SÓ busca por um novo empreendimento se não houver um na memória da conversa.
    if (!empreendimentoId) {
        const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');
        for (const emp of empreendimentos || []) {
            if (texto.includes(emp.nome.toLowerCase())) {
                empreendimentoId = emp.id;
                empreendimentoNome = emp.nome;
                context = { empreendimentoId, empreendimentoNome };
                await saveConversationContext(supabase, senderPhone, context); // Salva na memória ASSIM que encontra
                break;
            }
        }
    }
    
    // 2. AGORA, se mesmo depois de procurar, ainda não sabemos qual é, pedimos ajuda.
    if (!empreendimentoId) {
        await sendTextMessage(supabase, config, senderPhone, contactId, "Olá! Sou a Stella. Para que eu possa te ajudar, por favor, me diga o nome do empreendimento sobre o qual deseja informações.");
        return; // Para a execução aqui.
    }

    // 3. Se já sabemos o empreendimento, continuamos para responder a pergunta.
    const querBook = texto.includes('book');
    const querTabela = texto.includes('tabela');
    let resposta;

    if (querBook) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('caminho_arquivo').eq('empreendimento_id', empreendimentoId).eq('categoria_aba', 'marketing').like('nome_arquivo', '%book%').limit(1).single();
        if (anexo) {
            const { data: urlData } = supabase.storage.from('empreendimento-anexos').getPublicUrl(anexo.caminho_arquivo);
            resposta = `Claro! Aqui está o link para o book do ${empreendimentoNome}:\n${urlData.publicUrl}`;
        } else {
            resposta = `Não encontrei o book de apresentação para o ${empreendimentoNome}.`;
        }
    } else if (querTabela) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('caminho_arquivo').eq('empreendimento_id', empreendimentoId).like('nome_arquivo', '%tabela%').limit(1).single();
        if (anexo) {
            const { data: urlData } = supabase.storage.from('empreendimento-anexos').getPublicUrl(anexo.caminho_arquivo);
            resposta = `Com certeza! A tabela de vendas do ${empreendimentoNome} está aqui:\n${urlData.publicUrl}`;
        } else {
            resposta = `Não localizei a tabela de vendas para o ${empreendimentoNome} no momento.`;
        }
    } else {
        resposta = await answerQuestionBasedOnMemory(supabase, empreendimentoId, messageText);
    }
    
    await sendTextMessage(supabase, config, senderPhone, contactId, resposta);
    // Salva o contexto novamente para manter a conversa ativa
    await saveConversationContext(supabase, senderPhone, context);
}
// ***** FIM DA LÓGICA CORRIGIDA *****


// --- WEBHOOK PRINCIPAL (POST e GET - Sem alterações) ---
export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
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
            
            if (messageContent && messageEntry.type === 'text') {
                processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
        }
        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}