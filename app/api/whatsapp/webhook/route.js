// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- FUNÇÕES DE COMUNICAÇÃO COM WHATSAPP (MANTIDAS) ---

// Esta função envia uma mensagem de texto via WhatsApp
async function sendTextMessage(supabase, config, to, contatoId, text) { // CORRIGIDO: contatoId
    if (!text || text.trim() === "") return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mensagem de texto via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: text, direction: 'outbound', status: 'sent', raw_payload: payload }); // CORRIGIDO: contato_id
        }
    } catch (error) { console.error("ERRO de rede ao enviar mensagem de texto:", error); }
}

// Esta função envia um arquivo de mídia (documento) via WhatsApp
async function sendMediaMessage(supabase, config, to, contatoId, publicUrl, fileName, caption) { // CORRIGIDO: contatoId
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "document", document: { link: publicUrl, filename: fileName, caption: caption } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mídia via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: caption, direction: 'outbound', status: 'sent', raw_payload: payload }); // CORRIGIDO: contato_id
        }
    } catch (error) { console.error("ERRO de rede ao enviar mídia:", error); }
}

// --- FUNÇÕES AUXILIARES (MANTIDAS) ---

// Extrai o conteúdo de texto de uma mensagem do WhatsApp
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

// Normaliza números de telefone para busca no banco de dados
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let numbersToSearch = new Set([digitsOnly]);
    // Adiciona o DDI 55 se não estiver presente e o número tiver tamanho típico de telefone brasileiro
    if (!digitsOnly.startsWith('55') && (digitsOnly.length === 10 || digitsOnly.length === 11)) { 
        numbersToSearch.add('55' + digitsOnly); 
    }
    return Array.from(numbersToSearch);
}

// --- ROTAS (WEBHOOK) ---

// Rota GET para verificação do webhook do WhatsApp
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

// Rota POST para receber mensagens do webhook do WhatsApp
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').limit(1).single();
        if (!whatsappConfig) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp não encontradas.");
            return NextResponse.json({ status: 'error', message: 'Configuração do WhatsApp ausente.' }, { status: 500 });
        }

        // Processa atualizações de status de mensagens (vistos)
        const statusEntry = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
        if (statusEntry) {
            const messageId = statusEntry.id;
            const newStatus = statusEntry.status; // 'sent', 'delivered', 'read'

            // Mapeia o status do WhatsApp para o status no seu banco de dados (se necessário)
            let dbStatus;
            switch (newStatus) {
                case 'sent': dbStatus = 'sent'; break;
                case 'delivered': dbStatus = 'delivered'; break;
                case 'read': dbStatus = 'read'; break;
                default: dbStatus = 'sent'; // Status padrão se for desconhecido
            }

            console.log(`Atualização de status: message_id=${messageId}, status=${dbStatus}`);

            const { error: updateError } = await supabaseAdmin
                .from('whatsapp_messages')
                .update({ status: dbStatus })
                .eq('message_id', messageId);

            if (updateError) {
                console.error("Erro ao atualizar status da mensagem:", updateError);
            }
            return NextResponse.json({ status: 'ok' }); // Retorna para evitar processar como mensagem normal
        }


        // Processa mensagens de entrada
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contatoId = null; // CORRIGIDO: contatoId
            let shouldSendAutoReply = false; // Flag para controlar a auto-resposta

            // 1. Busca o ID do contato associado ao número de telefone
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones?.length > 0) {
                contatoId = matchingPhones[0].contato_id; // CORRIGIDO: contatoId
            }
            
            // 2. Se o contato não foi encontrado, cria um novo contato provisório
            if (!contatoId) { // CORRIGIDO: contatoId
                console.log(`[Webhook] Novo contato detectado: ${contactPhoneNumber}. Criando registro provisório.`);
                const { data: newContact, error: contactError } = await supabaseAdmin
                    .from('contatos')
                    .insert({ 
                        nome: `Novo Contato (${contactPhoneNumber})`, // Nome provisório
                        tipo: 'Lead', // Ou um tipo padrão para contatos novos
                        is_unregistered: true // Flag para indicar que é provisório
                    })
                    .select('id')
                    .single();

                if (contactError) {
                    console.error("ERRO ao criar novo contato provisório:", contactError);
                    // Se não conseguir criar o contato, não prosseguir
                    return NextResponse.json({ status: 'error', message: 'Falha ao criar contato provisório.' }, { status: 500 });
                }
                contatoId = newContact.id; // CORRIGIDO: contatoId

                // Associa o telefone ao novo contato
                const { error: phoneError } = await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, // CORRIGIDO: contato_id
                    telefone: contactPhoneNumber,
                    tipo: 'celular' // Tipo padrão
                });

                if (phoneError) {
                    console.error("ERRO ao associar telefone ao novo contato:", phoneError);
                    // Não é um erro crítico para parar, mas é importante logar
                }
                shouldSendAutoReply = true; // Define para enviar auto-resposta
            }
            
            // 3. Salva a mensagem recebida no banco de dados, usando o contatoId (existente ou novo)
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId, // CORRIGIDO: contato_id
                message_id: messageEntry.id,
                sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id,
                content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered',
                raw_payload: messageEntry,
            });

            // 4. Se for um novo contato, envia a mensagem automática pedindo o nome
            if (shouldSendAutoReply) {
                const autoReplyText = "Olá! 👋 Sou um assistente virtual. Recebi sua mensagem de um número novo aqui. Para que eu possa te ajudar melhor, poderia me informar o seu nome?";
                await sendTextMessage(supabaseAdmin, whatsappConfig, contactPhoneNumber, contatoId, autoReplyText); // CORRIGIDO: contatoId
                console.log(`[Webhook] Mensagem automática enviada para novo contato ${contactPhoneNumber}.`);
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
