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

// Esta função envia um arquivo de mídia (documento) via WhatsApp
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
    // Adiciona o DDI do Brasil se não estiver presente e o tamanho for de um número brasileiro
    if (!digitsOnly.startsWith('55')) { numbersToSearch.add('55' + digitsOnly); }
    return Array.from(numbersToSearch);
}

// --- ROTAS (WEBHOOK) ---

// Rota GET para verificação do webhook do WhatsApp
export async function GET(request) {
    const searchParams = new URL(request.url).searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // Certifique-se de que esta variável de ambiente está configurada

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// Rota POST para receber mensagens e status do webhook do WhatsApp
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').limit(1).single();
        if (!whatsappConfig) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp não encontradas.");
            return NextResponse.json({ status: 'error', message: 'Configuração do WhatsApp ausente.' }, { status: 500 });
        }

        // --- Processa mensagens recebidas ---
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contactId = null;

            // Busca o ID do contato associado ao número de telefone
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones?.length > 0) contactId = matchingPhones[0].contato_id;
            
            // Salva a mensagem recebida no banco de dados
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contactId,
                message_id: messageEntry.id,
                sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id,
                content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered', // Mensagens recebidas são consideradas 'delivered' inicialmente
                raw_payload: messageEntry, // Salva o payload completo para depuração
            });
            console.log(`[WHATSAPP WEBHOOK] Mensagem recebida e salva: ${messageEntry.id}`);
        }

        // --- Processa atualizações de status (delivered, read) ---
        const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
        if (statuses) {
            const messageId = statuses.id; // ID da mensagem do WhatsApp
            let newStatus = statuses.status; // 'delivered', 'read'

            // Mapeia os status do WhatsApp para os que você quer usar se necessário.
            // Por exemplo, 'sent' no WhatsApp API é geralmente o status inicial antes de 'delivered'.
            // Aqui, vamos direto para 'delivered' ou 'read'.
            if (newStatus === 'sent') {
                newStatus = 'sent'; // Ou manter como 'sent' se você quiser diferenciar
            } else if (newStatus === 'delivered') {
                newStatus = 'delivered';
            } else if (newStatus === 'read') {
                newStatus = 'read';
            } else {
                console.warn(`[WHATSAPP WEBHOOK] Status desconhecido: ${newStatus} para messageId: ${messageId}`);
                newStatus = 'unknown'; // Para status não mapeados
            }

            // Atualiza o status da mensagem no banco de dados
            const { error: updateError } = await supabaseAdmin
                .from('whatsapp_messages')
                .update({ status: newStatus })
                .eq('message_id', messageId); // Usa o message_id do WhatsApp para encontrar a mensagem

            if (updateError) {
                console.error(`[WHATSAPP WEBHOOK] Erro ao atualizar status da mensagem ${messageId}:`, updateError);
            } else {
                console.log(`[WHATSAPP WEBHOOK] Status da mensagem ${messageId} atualizado para: ${newStatus}`);
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
