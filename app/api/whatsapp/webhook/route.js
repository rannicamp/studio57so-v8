// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_supabase_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- FUNÇÕES DE COMUNICAÇÃO COM WHATSAPP (ATUALIZADAS) ---

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
            // ADICIONADO: organizacao_id no insert
            await supabase.from('whatsapp_messages').insert({ 
                contato_id: contatoId, 
                message_id: messageId, 
                sender_id: config.whatsapp_phone_number_id, 
                receiver_id: to, 
                content: text, 
                direction: 'outbound', 
                status: 'sent', 
                raw_payload: payload, 
                sent_at: new Date().toISOString(),
                organizacao_id: config.organizacao_id 
            });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mensagem de texto:", error); }
}

async function sendMediaMessage(supabase, config, to, contatoId, publicUrl, fileName, caption) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "document", document: { link: publicUrl, filename: fileName, caption: caption } };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) { console.error("ERRO ao enviar mídia via WhatsApp:", responseData); return; }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            // ADICIONADO: organizacao_id no insert
            await supabase.from('whatsapp_messages').insert({ 
                contato_id: contatoId, 
                message_id: messageId, 
                sender_id: config.whatsapp_phone_number_id, 
                receiver_id: to, 
                content: caption, 
                direction: 'outbound', 
                status: 'sent', 
                raw_payload: payload, 
                sent_at: new Date().toISOString(),
                organizacao_id: config.organizacao_id
            });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mídia:", error); }
}

// --- FUNÇÕES AUXILIARES (MANTIDAS) ---

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
    let numbersToSearch = new Set();
    numbersToSearch.add(digitsOnly);
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        numbersToSearch.add(digitsOnly); 
    } else if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
        numbersToSearch.add(digitsOnly);
    } else if (digitsOnly.length === 10 || digitsOnly.length === 11) {
        numbersToSearch.add('55' + digitsOnly);
    }
    return Array.from(numbersToSearch);
}

// --- ROTAS (WEBHOOK) ---

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
        console.log("[WEBHOOK] Corpo da requisição recebido:", JSON.stringify(body, null, 2));

        // ALTERADO: Adicionado 'organizacao_id' na busca de configurações
        const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*, organizacao_id').limit(1).single();
        if (!whatsappConfig || !whatsappConfig.organizacao_id) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp ou organizacao_id não encontradas.");
            return NextResponse.json({ status: 'error', message: 'Configuração do WhatsApp ou organizacao_id ausente.' }, { status: 500 });
        }

        const statusEntry = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
        if (statusEntry) {
            const messageId = statusEntry.id;
            const newStatus = statusEntry.status;
            let dbStatus;
            switch (newStatus) {
                case 'sent': dbStatus = 'sent'; break;
                case 'delivered': dbStatus = 'delivered'; break;
                case 'read': dbStatus = 'read'; break;
                default: dbStatus = 'sent';
            }
            console.log(`[WEBHOOK STATUS] Atualização de status: message_id=${messageId}, status=${dbStatus}`);
            await supabaseAdmin.from('whatsapp_messages').update({ status: dbStatus }).eq('message_id', messageId);
            await supabaseAdmin.from('whatsapp_conversations').upsert({ phone_number: statusEntry.recipient_id, updated_at: new Date().toISOString() }, { onConflict: ['phone_number'] });
            return NextResponse.json({ status: 'ok' });
        }

        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            console.log("[WEBHOOK MESSAGE] Nova mensagem recebida:", JSON.stringify(messageEntry, null, 2));
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contatoId = null;
            let currentContato = null;
            let shouldSendAutoReply = false;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            
            if (matchingPhones?.length > 0) {
                contatoId = matchingPhones[0].contato_id;
            }
            
            if (!contatoId) {
                console.log(`[WEBHOOK MESSAGE] Contato não encontrado para ${contactPhoneNumber}. Criando provisório.`);
                const { data: newContact, error: contactError } = await supabaseAdmin
                    .from('contatos')
                    .insert({ 
                        nome: `Desconhecido (${contactPhoneNumber})`,
                        tipo_contato: 'Lead',
                        is_awaiting_name_response: true,
                        // ADICIONADO: organizacao_id na criação do novo contato
                        organizacao_id: whatsappConfig.organizacao_id 
                    })
                    .select('*')
                    .single();

                if (contactError) {
                    console.error("ERRO ao criar novo contato provisório:", contactError);
                    return NextResponse.json({ status: 'error', message: 'Falha ao criar contato.' }, { status: 500 });
                }
                contatoId = newContact.id;
                currentContato = newContact;
                
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId,
                    telefone: contactPhoneNumber,
                    tipo: 'celular'
                });
                
                shouldSendAutoReply = true;

                const { data: funnelData } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', whatsappConfig.organizacao_id).order('created_at').limit(1).single();
                if (funnelData) {
                    const { data: columnData } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funnelData.id).order('ordem').limit(1).single();
                    if (columnData) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: columnData.id });
                        console.log(`[WEBHOOK CRM] Card criado no CRM para novo contato.`);
                    }
                }
            } else {
                const { data: existingContato } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                currentContato = existingContato;
            }

            if (currentContato?.is_awaiting_name_response && messageContent && messageContent.length > 2 && !/^(oi|olá|obrigado)$/i.test(messageContent.toLowerCase())) {
                await supabaseAdmin.from('contatos').update({ nome: messageContent, is_awaiting_name_response: false }).eq('id', contatoId);
            }
            
            // ADICIONADO: organizacao_id no insert da mensagem recebida
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId,
                message_id: messageEntry.id,
                sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id,
                content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered',
                raw_payload: messageEntry,
                organizacao_id: whatsappConfig.organizacao_id
            });

            await supabaseAdmin.from('whatsapp_conversations').upsert({ phone_number: contactPhoneNumber, updated_at: new Date().toISOString() }, { onConflict: ['phone_number'] });

            if (shouldSendAutoReply) {
                const autoReplyText = "Olá! 👋 Sou um assistente virtual. Recebi sua mensagem. Para que eu possa te ajudar melhor, poderia me informar o seu nome?";
                await sendTextMessage(supabaseAdmin, whatsappConfig, contactPhoneNumber, contatoId, autoReplyText);
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook (catch final):", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}