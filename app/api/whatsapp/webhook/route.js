import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para extrair o conteúdo de texto da complexa resposta do WhatsApp
function getTextContent(message) {
    if (message.type === 'text') {
        return message.text?.body || null;
    }
    if (message.type === 'interactive') {
        if (message.interactive?.button_reply) {
            return message.interactive.button_reply.title;
        }
        if (message.interactive?.list_reply) {
            return message.interactive.list_reply.title;
        }
    }
    return `Mensagem do tipo '${message.type}' recebida.`;
}

// NOVO: Função para normalizar e gerar variações de números de telefone para busca
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, ''); // Remove tudo que não for dígito

    let numbersToSearch = new Set();
    numbersToSearch.add(digitsOnly); // Adiciona o número original (apenas dígitos)

    // Lógica para números brasileiros (DDIs comuns)
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
    // Se o número tem 11 dígitos e começa com 55 e um DDD
    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) { // Ex: 5531988887777
        const ddiDdd = digitsOnly.substring(0, 4); // "5531"
        const remainingDigits = digitsOnly.substring(4); // "988887777"
        if (remainingDigits.startsWith('9') && remainingDigits.length === 9) {
            // Remove o '9' para criar a variação sem ele (apenas para busca)
            numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
        }
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) { // Ex: 553188887777
        const ddiDdd = digitsOnly.substring(0, 4); // "5531"
        const remainingDigits = digitsOnly.substring(4); // "88887777"
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

        // Estrutura padrão de uma notificação do WhatsApp
        if (body.object === 'whatsapp_business_account') {
            const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

            if (messageEntry) {
                const senderPhone = messageEntry.from;
                const messageContent = getTextContent(messageEntry);
                const messageId = messageEntry.id;
                const timestamp = new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString();

                // NOVO: Lógica para buscar o contato pelo número de telefone, considerando variações
                const possiblePhones = normalizeAndGeneratePhoneNumbers(senderPhone);
                let contactId = null;
                let enterpriseId = null;

                const { data: matchingPhones, error: phoneSearchError } = await supabaseAdmin
                    .from('telefones')
                    .select('contato_id')
                    .in('telefone', possiblePhones)
                    .limit(1); // Limita a 1 resultado, se houver múltiplos matches por algum motivo

                if (phoneSearchError) {
                    console.error("ERRO ao buscar telefone correspondente:", phoneSearchError);
                } else if (matchingPhones && matchingPhones.length > 0) {
                    contactId = matchingPhones[0].contato_id;
                    // Se o contato for encontrado, buscar a empresa_id associada a ele
                    if (contactId) {
                        const { data: contactData, error: contactDataError } = await supabaseAdmin
                            .from('contatos')
                            .select('empresa_id')
                            .eq('id', contactId)
                            .single();
                        if (contactDataError) {
                            console.error("ERRO ao buscar empresa_id do contato:", contactDataError);
                        } else if (contactData) {
                            enterpriseId = contactData.empresa_id;
                        }
                    }
                }
                
                // Objeto para salvar no banco, com os nomes de colunas corretos
                const messageToSave = {
                    contato_id: contactId, // Usar o ID do contato encontrado pela lógica robusta
                    enterprise_id: enterpriseId, // Usar o ID da empresa do contato
                    message_id: messageId,
                    sender_id: senderPhone, // Quem enviou a mensagem
                    receiver_id: process.env.WHATSAPP_PHONE_NUMBER_ID, // O seu número que recebeu
                    content: messageContent,
                    sent_at: timestamp,
                    direction: 'inbound', // 'inbound' significa "de entrada"
                    status: 'delivered',
                    raw_payload: messageEntry,
                };
                
                const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);

                if (dbError) {
                    console.error("ERRO ao salvar mensagem recebida no banco:", dbError);
                } else {
                    console.log("SUCESSO: Mensagem do cliente salva no banco de dados.");
                }
            }
        }
        
        // Responde à Meta com status 200 OK para confirmar o recebimento
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 500 });
    }
}