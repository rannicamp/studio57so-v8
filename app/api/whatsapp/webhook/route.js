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
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: text, direction: 'outbound', status: 'sent', raw_payload: payload, sent_at: new Date().toISOString() });
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
            await supabase.from('whatsapp_messages').insert({ contato_id: contatoId, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to, content: caption, direction: 'outbound', status: 'sent', raw_payload: payload, sent_at: new Date().toISOString() });
        }
    } catch (error) { console.error("ERRO de rede ao enviar mídia:", error); }
}

// --- FUNÇÕES AUXILIARES (ATUALIZADAS E MANTIDAS) ---

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

// ##### INÍCIO DA ALTERAÇÃO INTELIGENTE #####
// Esta função agora é mais inteligente para identificar o país do número.
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let numbersToSearch = new Set();
    
    // Adiciona o número exatamente como veio (apenas dígitos)
    numbersToSearch.add(digitsOnly);

    // Lógica para EUA/Canadá (código de país '1')
    // Um número completo dos EUA com DDI tem 11 dígitos e começa com 1.
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        // Já está no formato correto (Ex: 17815002711)
        numbersToSearch.add(digitsOnly); 
    }
    // Lógica para o Brasil (código de país '55')
    else if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
        // Número já está com DDI do Brasil, não faz nada.
        numbersToSearch.add(digitsOnly);
    }
    // Lógica para números SEM DDI
    else if (digitsOnly.length === 10 || digitsOnly.length === 11) {
        // Se tem 10 ou 11 dígitos e não começa com '1', é muito provável que seja do Brasil.
        numbersToSearch.add('55' + digitsOnly);
    }
    
    // Devolve uma lista de possíveis números para buscar no banco de dados.
    return Array.from(numbersToSearch);
}
// ##### FIM DA ALTERAÇÃO INTELIGENTE #####


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
        console.log("[WEBHOOK] Corpo da requisição recebido:", JSON.stringify(body, null, 2));

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

            console.log(`[WEBHOOK STATUS] Atualização de status: message_id=${messageId}, status=${dbStatus}`);

            const { error: updateError } = await supabaseAdmin
                .from('whatsapp_messages')
                .update({ status: dbStatus })
                .eq('message_id', messageId);

            if (updateError) {
                console.error("[WEBHOOK STATUS] Erro ao atualizar status da mensagem:", updateError);
            }

            // --- ATUALIZA updated_at da conversa para ordenação ---
            await supabaseAdmin.from('whatsapp_conversations')
                .upsert({ phone_number: statusEntry.recipient_id, updated_at: new Date().toISOString() }, { onConflict: ['phone_number'] });
            // --- FIM ATUALIZA updated_at ---

            return NextResponse.json({ status: 'ok' });
        }


        // Processa mensagens de entrada
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            console.log("[WEBHOOK MESSAGE] Nova mensagem recebida:", JSON.stringify(messageEntry, null, 2));

            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contatoId = null;
            let currentContato = null; // Adicionado para buscar os detalhes do contato
            let shouldSendAutoReply = false;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            console.log("[WEBHOOK MESSAGE] Telefones normalizados para busca:", possiblePhones);

            const { data: matchingPhones, error: matchingPhonesError } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            
            if (matchingPhonesError) {
                console.error("[WEBHOOK MESSAGE] Erro ao buscar telefone existente:", matchingPhonesError);
            } else if (matchingPhones?.length > 0) {
                contatoId = matchingPhones[0].contato_id;
                console.log("[WEBHOOK MESSAGE] Contato existente encontrado, ID:", contatoId);
            }
            
            if (!contatoId) {
                console.log(`[WEBHOOK MESSAGE] Contato não encontrado para ${contactPhoneNumber}. Tentando criar provisório.`);
                const { data: newContact, error: contactError } = await supabaseAdmin
                    .from('contatos')
                    .insert({ 
                        nome: `Desconhecido (${contactPhoneNumber})`,
                        tipo_contato: 'Lead',
                        is_awaiting_name_response: true
                    })
                    .select('*')
                    .single();

                if (contactError) {
                    console.error("ERRO ao criar novo contato provisório:", contactError);
                    return NextResponse.json({ status: 'error', message: 'Falha ao criar contato provisório.' }, { status: 500 });
                }
                contatoId = newContact.id;
                currentContato = newContact;
                console.log("[WEBHOOK MESSAGE] Novo contato provisório criado, ID:", contatoId);

                const { error: phoneError } = await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId,
                    telefone: contactPhoneNumber,
                    tipo: 'celular'
                });

                if (phoneError) {
                    console.error("ERRO ao associar telefone ao novo contato provisório:", phoneError);
                }
                shouldSendAutoReply = true;

                // --- INÍCIO DA LÓGICA DE CRIAÇÃO DE CARD NO CRM ---
                const { data: funnelData, error: funnelError } = await supabaseAdmin.from('funis').select('id').order('created_at').limit(1).single();
                if (funnelError || !funnelData) {
                    console.error('Erro ao buscar funil padrão para CRM:', funnelError);
                } else {
                    const funilId = funnelData.id;
                    const { data: columnData, error: columnError } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funilId).order('ordem').limit(1).single();
                    if (columnError || !columnData) {
                        console.error('Erro ao buscar coluna padrão do funil para CRM:', columnError);
                    } else {
                        const colunaId = columnData.id;
                        const { error: crmInsertError } = await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: colunaId });
                        if (crmInsertError) {
                            console.error('Erro ao criar card no CRM (contatos_no_funil):', crmInsertError);
                        } else {
                            console.log(`[WEBHOOK CRM] Card criado no CRM para contato ${contatoId} na coluna ${colunaId}.`);
                        }
                    }
                }
                // --- FIM DA LÓGICA DE CRIAÇÃO DE CARD NO CRM ---
            } else {
                // Se o contato já existe, busca os detalhes para verificar a flag is_awaiting_name_response
                const { data: existingContato, error: fetchContatoError } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (fetchContatoError) {
                    console.error("ERRO ao buscar detalhes do contato existente:", fetchContatoError);
                } else {
                    currentContato = existingContato;
                }
            }

            // --- Lógica para atualizar o nome do contato ---
            if (currentContato && currentContato.is_awaiting_name_response && messageContent && messageContent.length > 2 && !messageContent.toLowerCase().includes('olá') && !messageContent.toLowerCase().includes('oi') && !messageContent.toLowerCase().includes('obrigado')) {
                const { error: nameUpdateError } = await supabaseAdmin
                    .from('contatos')
                    .update({ nome: messageContent, is_awaiting_name_response: false })
                    .eq('id', contatoId);
                if (nameUpdateError) {
                    console.error("ERRO ao atualizar nome do contato:", nameUpdateError);
                } else {
                    console.log(`[WEBHOOK] Nome do contato ${contatoId} atualizado para: ${messageContent}`);
                }
            }
            // --- Fim da lógica de atualização do nome ---
            
            // Insere a mensagem recebida no banco de dados
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
                console.error("ERRO ao salvar mensagem recebida:", messageInsertError);
            } else {
                console.log("[WEBHOOK MESSAGE] Mensagem recebida salva com sucesso no DB.");
            }

            // --- ATUALIZA updated_at da conversa para ordenação ---
            await supabaseAdmin.from('whatsapp_conversations')
                .upsert({ phone_number: contactPhoneNumber, updated_at: new Date().toISOString() }, { onConflict: ['phone_number'] });
            // --- FIM ATUALIZA updated_at ---


            if (shouldSendAutoReply) {
                const autoReplyText = "Olá! 👋 Sou um assistente virtual. Recebi sua mensagem de um número novo aqui. Para que eu possa te ajudar melhor, poderia me informar o seu nome?";
                await sendTextMessage(supabaseAdmin, whatsappConfig, contactPhoneNumber, contatoId, autoReplyText);
                console.log(`[WEBHOOK MESSAGE] Mensagem automática enviada para novo contato ${contactPhoneNumber}.`);
            }
        }
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook (catch final):", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}