import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para extrair o conteúdo de texto da complexa resposta do WhatsApp
function getTextContent(message) {
    if (!message || !message.type) {
        console.warn("WARN: Mensagem sem tipo definido em getTextContent:", message);
        return null;
    }
    switch (message.type) {
        case 'text':
            return message.text?.body || null;
        case 'interactive':
            if (message.interactive?.button_reply) {
                return message.interactive.button_reply.title;
            }
            if (message.interactive?.list_reply) {
                return message.interactive.list_reply.title;
            }
            return null; // Caso interativo sem resposta de botão/lista
        case 'image':
            return message.image?.caption || 'Mensagem de Imagem';
        case 'video':
            return message.video?.caption || 'Mensagem de Vídeo';
        case 'document':
            return message.document?.caption || message.document?.filename || 'Mensagem de Documento';
        case 'audio':
            return 'Mensagem de Áudio';
        case 'sticker':
            return 'Mensagem de Sticker';
        case 'contacts':
            return 'Mensagem de Contato';
        case 'location':
            return 'Mensagem de Localização';
        // Adicionado default para tipos não previstos
        default:
            console.warn(`WARN: Tipo de mensagem '${message.type}' não tratado em getTextContent.`);
            return `Mensagem do tipo '${message.type}' recebida.`;
    }
}

// Função para normalizar e gerar variações de números de telefone para busca
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, ''); // Remove tudo que não for dígito

    let numbersToSearch = new Set();
    numbersToSearch.add(digitsOnly); // Adiciona o número original (apenas dígitos)

    const brazilDDI = '55';
    const minBrazilLength = 10; // DDD + 8 dígitos (fixo)
    const maxBrazilLength = 11; // DDD + 9 dígitos (celular)

    // Se o número não começa com DDI brasileiro, tenta adicionar
    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === minBrazilLength || digitsOnly.length === maxBrazilLength) {
            numbersToSearch.add(brazilDDI + digitsOnly);
        }
    }

    // Lógica para lidar com o 9º dígito para números brasileiros (celular)
    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) { // Ex: 5531988887777
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        if (remainingDigits.startsWith('9') && remainingDigits.length === 9) {
            // Remove o '9' para criar a variação sem ele (apenas para busca)
            numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
        }
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) { // Ex: 553188887777
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        // Adiciona o '9' para criar a variação com ele (apenas para busca)
        numbersToSearch.add(ddiDdd + '9' + remainingDigits);
    }
    // Para outros DDIs, a lógica pode ser expandida conforme necessário.

    return Array.from(numbersToSearch);
}


export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("INFO: Webhook verificado com sucesso!");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("ERRO: Falha na verificação do webhook. Tokens não correspondem.");
        return new NextResponse(null, { status: 403 });
    }
}

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const body = await request.json();
        console.log("INFO: Payload recebido do webhook:", JSON.stringify(body, null, 2));

        // Buscar o WHATSAPP_PHONE_NUMBER_ID do banco de dados
        let SYSTEM_PHONE_NUMBER_ID = null;
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_phone_number_id')
            .limit(1)
            .single();

        if (configError) {
            console.error("ERRO ao buscar configurações do WhatsApp:", configError);
        } else if (config && config.whatsapp_phone_number_id) {
            SYSTEM_PHONE_NUMBER_ID = config.whatsapp_phone_number_id;
        }
        console.log("DEBUG: SYSTEM_PHONE_NUMBER_ID (do DB):", SYSTEM_PHONE_NUMBER_ID);


        if (body.object === 'whatsapp_business_account') {
            const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

            if (messageEntry) {
                const messageContent = getTextContent(messageEntry);
                const messageId = messageEntry.id;
                const timestamp = new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString();

                let partnerPhone = null;
                let messageDirection = null;

                // Lógica para determinar o 'partnerPhone' (o número do cliente) e a 'direction'
                // Se o remetente (messageEntry.from) for o seu número de sistema
                if (SYSTEM_PHONE_NUMBER_ID && messageEntry.from === SYSTEM_PHONE_NUMBER_ID) {
                    partnerPhone = messageEntry.to; // O número do cliente está no campo 'to'
                    messageDirection = 'outbound';
                    console.log("DEBUG: Direção OUTBOUND. PartnerPhone (messageEntry.to):", partnerPhone);
                } else {
                    // Caso contrário, o remetente (messageEntry.from) é o número do cliente
                    partnerPhone = messageEntry.from; // O número do cliente está no campo 'from'
                    messageDirection = 'inbound';
                    console.log("DEBUG: Direção INBOUND. PartnerPhone (messageEntry.from):", partnerPhone);
                }
                
                let contactId = null;
                let enterpriseId = null;

                if (partnerPhone) {
                    const possiblePhones = normalizeAndGeneratePhoneNumbers(partnerPhone);
                    console.log("DEBUG: PossiblePhones para busca:", possiblePhones);

                    const { data: matchingPhones, error: phoneSearchError } = await supabaseAdmin
                        .from('telefones')
                        .select('contato_id')
                        .in('telefone', possiblePhones)
                        .limit(1);

                    if (phoneSearchError) {
                        console.error("ERRO ao buscar telefone correspondente (webhook):", phoneSearchError);
                    } else if (matchingPhones && matchingPhones.length > 0) {
                        contactId = matchingPhones[0].contato_id;
                        if (contactId) {
                            const { data: contactData, error: contactDataError } = await supabaseAdmin
                                .from('contatos')
                                .select('empresa_id')
                                .eq('id', contactId)
                                .single();
                            if (contactDataError) {
                                console.error("ERRO ao buscar empresa_id do contato (webhook):", contactDataError);
                            } else if (contactData) {
                                enterpriseId = contactData.empresa_id;
                            }
                        }
                    }
                }
                console.log(`DEBUG: contactId: ${contactId}, enterpriseId: ${enterpriseId}`);
                
                const messageToSave = {
                    contato_id: contactId,
                    enterprise_id: enterpriseId,
                    message_id: messageId,
                    sender_id: messageEntry.from, // O número original do remetente no payload
                    receiver_id: messageEntry.to, // O número original do destinatário no payload
                    content: messageContent,
                    sent_at: timestamp,
                    direction: messageDirection, // 'inbound' ou 'outbound' (determinado pela lógica acima)
                    status: 'received' || messageEntry.status, // Usar 'received' para inbound, ou status do payload
                    raw_payload: messageEntry,
                };
                // Força o status para 'delivered' se for uma notificação de entrega outbound
                if (messageDirection === 'outbound' && messageEntry.status) {
                    messageToSave.status = messageEntry.status;
                } else if (messageDirection === 'inbound') {
                    messageToSave.status = 'received'; // Status padrão para mensagem de entrada
                }
                
                console.log("DEBUG: Objeto MessageToSave:", JSON.stringify(messageToSave, null, 2));

                const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);

                if (dbError) {
                    console.error("ERRO ao salvar mensagem no banco (final do webhook):", dbError);
                } else {
                    console.log("SUCESSO: Mensagem salva no banco de dados.");
                }
            } else {
                console.log("INFO: Payload recebido, mas sem 'messageEntry'. Ignorando.");
            }
        } else {
            console.log("INFO: Payload recebido, mas não é 'whatsapp_business_account'. Ignorando.");
        }
        
        // Sempre retorna 200 OK para a API do WhatsApp.
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook (try-catch principal):", error);
        // Em caso de erro não tratado, ainda retorna 200 OK para evitar que o WhatsApp reenvie o mesmo payload.
        return new NextResponse(null, { status: 200 });
    }
}