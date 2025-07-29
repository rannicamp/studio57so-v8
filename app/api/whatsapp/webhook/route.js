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
async function sendTextMessage(supabase, config, to, contatoId, text) {
    if (!text || text.trim() === "") return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mensagem de texto via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: text, direction: 'outbound', status: 'sent', raw_payload: payload });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mensagem de texto:", error); }
}

// Esta função envia um arquivo de mídia (documento) via WhatsApp
async function sendMediaMessage(supabase, config, to, contatoId, publicUrl, fileName, caption) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "document", document: { link: publicUrl, filename: fileName, caption: caption } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mídia via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: caption, direction: 'outbound', status: 'sent', raw_payload: payload });
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
        console.log("[WEBHOOK] Corpo da requisição recebido:", JSON.stringify(body, null, 2)); // DEBUG: Loga o corpo completo

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

            let dbStatus;
            switch (newStatus) {
                case 'sent': dbStatus = 'sent'; break;
                case 'delivered': dbStatus = 'delivered'; break;
                case 'read': dbStatus = 'read'; break;
                default: dbStatus = 'sent';
            }

            console.log(`[WEBHOOK STATUS] Atualização de status: message_id=${messageId}, status=${dbStatus}`); // DEBUG: Loga a atualização de status

            const { error: updateError } = await supabaseAdmin
                .from('whatsapp_messages')
                .update({ status: dbStatus })
                .eq('message_id', messageId);

            if (updateError) {
                console.error("[WEBHOOK STATUS] Erro ao atualizar status da mensagem:", updateError); // DEBUG: Loga erro na atualização
            }
            return NextResponse.json({ status: 'ok' });
        }


        // Processa mensagens de entrada
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            console.log("[WEBHOOK MESSAGE] Nova mensagem recebida:", JSON.stringify(messageEntry, null, 2)); // DEBUG: Loga a mensagem completa

            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contatoId = null;
            let shouldSendAutoReply = false;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            console.log("[WEBHOOK MESSAGE] Telefones normalizados para busca:", possiblePhones); // DEBUG: Loga telefones normalizados

            const { data: matchingPhones, error: matchingPhonesError } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            
            if (matchingPhonesError) {
                console.error("[WEBHOOK MESSAGE] Erro ao buscar telefone existente:", matchingPhonesError); // DEBUG: Loga erro na busca
            } else if (matchingPhones?.length > 0) {
                contatoId = matchingPhones[0].contato_id;
                console.log("[WEBHOOK MESSAGE] Contato existente encontrado, ID:", contatoId); // DEBUG: Loga ID do contato existente
            }
            
            if (!contatoId) {
                console.log(`[WEBHOOK MESSAGE] Contato não encontrado para ${contactPhoneNumber}. Tentando criar provisório.`); // DEBUG: Novo contato
                const { data: newContact, error: contactError } = await supabaseAdmin
                    .from('contatos')
                    .insert({ 
                        nome: `Desconhecido (${contactPhoneNumber})`, // ALTERADO: Nome inicial para "Desconhecido"
                        tipo: 'Lead',
                        is_unregistered: true 
                    })
                    .select('id')
                    .single();

                if (contactError) {
                    console.error("ERRO ao criar novo contato provisório:", contactError); // DEBUG: Erro ao criar
                    return NextResponse.json({ status: 'error', message: 'Falha ao criar contato provisório.' }, { status: 500 });
                }
                contatoId = newContact.id;
                console.log("[WEBHOOK MESSAGE] Novo contato provisório criado, ID:", contatoId); // DEBUG: ID do novo contato

                const { error: phoneError } = await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId,
                    telefone: contactPhoneNumber,
                    tipo: 'celular'
                });

                if (phoneError) {
                    console.error("ERRO ao associar telefone ao novo contato provisório:", phoneError); // DEBUG: Erro ao associar telefone
                }
                shouldSendAutoReply = true;
            }
            
            const { error: messageInsertError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId,
                message_id: messageEntry.id,
                sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id,
                content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered',
                raw_payload: messageEntry,
            });

            if (messageInsertError) {
                console.error("ERRO ao salvar mensagem recebida:", messageInsertError); // DEBUG: Erro ao salvar mensagem
            } else {
                console.log("[WEBHOOK MESSAGE] Mensagem recebida salva com sucesso no DB."); // DEBUG: Mensagem salva
            }

            if (shouldSendAutoReply) {
                const autoReplyText = "Olá! 👋 Sou um assistente virtual. Recebi sua mensagem de um número novo aqui. Para que eu possa te ajudar melhor, poderia me informar o seu nome?";
                await sendTextMessage(supabaseAdmin, whatsappConfig, contactPhoneNumber, contatoId, autoReplyText);
                console.log(`[WEBHOOK MESSAGE] Mensagem automática enviada para novo contato ${contactPhoneNumber}.`); // DEBUG: Auto-resposta enviada
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook (catch final):", error); // DEBUG: Erro geral
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
