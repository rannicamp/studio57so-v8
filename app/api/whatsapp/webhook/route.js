// /app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { analisarMensagemDeLead } from '@/utils/stella-sdr';

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

// --- FERRAMENTAS DA IA (Funções que a IA pode chamar) ---
// (As funções como criar_atividade, etc., são mantidas para uso futuro, mas a lógica principal mudou)


// --- FUNÇÕES DE COMUNICAÇÃO COM WHATSAPP ---
// (As funções sendTextMessage e sendMediaMessage são mantidas como estão)
async function sendTextMessage(supabase, config, to, contactId, text) {
    if (!text || text.trim() === "") return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mensagem de texto via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId && contactId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contactId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: text, direction: 'outbound', status: 'sent', raw_payload: payload });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mensagem de texto:", error); }
}


// --- O NOVO "CÉREBRO" DA STELLA (LÓGICA DE CONVERSA INTELIGENTE) ---

async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    console.log(`[STELLA-PRO] Iniciando lógica de conversa para Contato ID: ${contactId}`);

    // 1. Identificar o Empreendimento do qual estamos falando (foco no "Alfa")
    const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');
    // Vamos simplificar e focar no Residencial Alfa por enquanto, como solicitado.
    const empreendimentoAlfa = empreendimentos?.find(emp => emp.nome.toLowerCase().includes('alfa'));
    
    if (!empreendimentoAlfa) {
        console.error("[STELLA-PRO] Empreendimento 'Alfa' não encontrado no banco de dados.");
        const respostaErro = "Estou com dificuldades para encontrar as informações do nosso empreendimento principal. Nossa equipe já foi notificada e entrará em contato.";
        await sendTextMessage(supabase, config, senderPhone, contactId, respostaErro);
        return;
    }
    const empreendimentoId = empreendimentoAlfa.id;

    // 2. Buscar informações nos documentos do empreendimento (O "Cérebro" da Stella)
    console.log(`[STELLA-PRO] Buscando documentos para a pergunta: "${messageText}"`);
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const resultEmbedding = await embeddingModel.embedContent(messageText);
    const embedding = resultEmbedding.embedding.values;
    
    const { data: chunks, error: rpcError } = await supabase.rpc('match_documento_empreendimento', {
        query_embedding: embedding,
        match_threshold: 0.75, // Aumentamos um pouco a precisão
        match_count: 5,
        p_empreendimento_id: empreendimentoId
    });

    if (rpcError) {
        console.error("[STELLA-PRO] Erro ao buscar nos documentos via RPC:", rpcError);
        const respostaErro = "Tive um problema ao consultar nossos documentos internos. Já notifiquei a equipe técnica. Em breve um consultor falará com você.";
        await sendTextMessage(supabase, config, senderPhone, contactId, respostaErro);
        return;
    }

    const contextText = chunks && chunks.length > 0
        ? chunks.map((c, i) => `Trecho ${i+1}:\n${c.content}`).join('\n\n---\n\n')
        : "Nenhuma informação encontrada nos documentos.";

    console.log(`[STELLA-PRO] Contexto encontrado:\n${contextText}`);

    // 3. Montar o Prompt de Sistema Avançado (A "Personalidade" da Stella)
    const prompt = `
      Você é a Stella, uma assistente de vendas especialista e altamente capacitada do "Residencial Alfa".
      Sua comunicação deve ser clara, objetiva, profissional e amigável.

      Sua principal função é responder às dúvidas dos clientes com base, EXCLUSIVAMENTE, nas informações fornecidas abaixo na seção "CONTEXTO DOS DOCUMENTOS".

      REGRAS OBRIGATÓRIAS:
      1.  **BASEIE-SE NOS FATOS:** Todas as suas respostas devem ser extraídas diretamente do contexto fornecido. Não invente, deduza ou adicione qualquer informação que não esteja lá.
      2.  **SEJA DIRETA:** Responda à pergunta do cliente de forma direta e sem rodeios.
      3.  **CITE A FONTE IMPLICITAMENTE:** Formule a resposta de uma maneira que deixe claro que a informação vem de uma fonte confiável (ex: "De acordo com nossa tabela de vendas...", "Em nosso memorial descritivo, consta que...").
      4.  **SE A INFORMAÇÃO NÃO EXISTIR:** Se o contexto não contiver a resposta para a pergunta do cliente, você DEVE responder EXATAMENTE com a seguinte frase: "Não encontrei essa informação específica em nossos documentos. Para garantir a precisão, já encaminhei sua pergunta para um de nossos consultores especialistas, que entrará em contato em breve para esclarecer todos os detalhes para você. 👍"
      5.  **NÃO USE FERRAMENTAS:** Não tente chamar nenhuma outra função ou ferramenta. Sua única tarefa é gerar uma resposta em texto.

      ---
      CONTEXTO DOS DOCUMENTOS:
      ${contextText}
      ---

      PERGUNTA DO CLIENTE:
      "${messageText}"

      Agora, formule a resposta ideal.
    `;

    // 4. Gerar a resposta com o modelo de IA
    console.log("[STELLA-PRO] Gerando resposta com o Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest", safetySettings });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const respostaFinal = response.text();
    
    console.log(`[STELLA-PRO] Resposta gerada: "${respostaFinal}"`);

    // 5. Enviar a resposta final para o cliente
    await sendTextMessage(supabase, config, senderPhone, contactId, respostaFinal);
}


// --- FUNÇÕES AUXILIARES E WEBHOOK (Estrutura principal) ---

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
            if (matchingPhones?.length > 0) {
                contactId = matchingPhones[0].contato_id;
            }

            // --- LÓGICA DE ROTEAMENTO INTELIGENTE ---

            if (!contactId && messageContent) {
                console.log(`[WEBHOOK] Número novo (${contactPhoneNumber}). Acionando Stella SDR para qualificação...`);
                const sdrResult = await analisarMensagemDeLead(supabaseAdmin, messageContent, contactPhoneNumber, whatsappConfig, sendTextMessage);

                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: sdrResult.novoContatoId,
                    message_id: messageEntry.id, sender_id: messageEntry.from,
                    receiver_id: whatsappConfig.whatsapp_phone_number_id, content: messageContent,
                    sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                    direction: 'inbound', status: 'processed_by_sdr', raw_payload: messageEntry,
                });
                
                return NextResponse.json({ status: 'ok' });
            }
            
            if (contactId && messageContent) {
                 await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: contactId, message_id: messageEntry.id, sender_id: messageEntry.from,
                    receiver_id: whatsappConfig.whatsapp_phone_number_id, content: messageContent,
                    sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                    direction: 'inbound', status: 'delivered', raw_payload: messageEntry,
                });

                console.log(`[WEBHOOK] Contato existente (ID: ${contactId}). Acionando Stella-PRO...`);
                await processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error.message, error.stack);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}