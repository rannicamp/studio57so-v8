// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES (Sua lógica original, mantida 100%)
// -----------------------------------------------------------------------------

function getTextContent(message) {
    if (!message || !message.type) {
        console.warn("WARN: Mensagem sem tipo definido em getTextContent:", message);
        return null;
    }
    switch (message.type) {
        case 'text': return message.text?.body || null;
        case 'interactive':
            if (message.interactive?.button_reply) return message.interactive.button_reply.title;
            if (message.interactive?.list_reply) return message.interactive.list_reply.title;
            return null;
        case 'image': return message.image?.caption || 'Imagem Recebida';
        case 'video': return message.video?.caption || 'Vídeo Recebido';
        case 'document': return message.document?.caption || message.document?.filename || 'Documento Recebido';
        case 'audio': return 'Áudio Recebido';
        case 'sticker': return 'Sticker Recebido';
        case 'contacts': return 'Contato Recebido';
        case 'location': return 'Localização Recebida';
        default:
            console.warn(`WARN: Tipo de mensagem '${message.type}' não tratado em getTextContent.`);
            return `Mensagem do tipo '${message.type}' recebida.`;
    }
}

function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let numbersToSearch = new Set([digitsOnly]);
    const brazilDDI = '55';
    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
            numbersToSearch.add(brazilDDI + digitsOnly);
        }
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

async function handleMediaMessage(supabase, whatsappConfig, message) {
    const mediaId = message.image?.id || message.video?.id || message.document?.id || message.audio?.id;
    if (!mediaId) {
        console.warn("WARN: Mensagem de mídia recebida, mas sem ID.", message);
        return null;
    }
    const mediaDetailsUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
    const mediaDetailsResponse = await fetch(mediaDetailsUrl, {
        headers: { 'Authorization': `Bearer ${whatsappConfig.whatsapp_permanent_token}` }
    });
    if (!mediaDetailsResponse.ok) {
        console.error("ERRO: Falha ao buscar detalhes da mídia no WhatsApp.", await mediaDetailsResponse.json());
        return null;
    }
    const mediaDetails = await mediaDetailsResponse.json();
    const mediaUrl = mediaDetails.url;
    const mediaMimeType = mediaDetails.mime_type;
    
    if (!mediaUrl) {
        console.error("ERRO: A API do WhatsApp não retornou uma URL para a mídia.");
        return null;
    }
    const mediaFileResponse = await fetch(mediaUrl, {
        headers: { 'Authorization': `Bearer ${whatsappConfig.whatsapp_permanent_token}` }
    });
    if (!mediaFileResponse.ok) {
        console.error("ERRO: Falha ao baixar a mídia da URL fornecida pelo WhatsApp.");
        return null;
    }
    const mediaBuffer = await mediaFileResponse.arrayBuffer();
    const fileName = message.document?.filename || `${message.type}_${mediaId}.${mediaMimeType.split('/')[1] || 'bin'}`;
    const contactId = message.from;
    const filePath = `${contactId}/${Date.now()}_${fileName}`;
    const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, mediaBuffer, { contentType: mediaMimeType });
    if (uploadError) {
        console.error("ERRO: Falha ao fazer upload da mídia para o Supabase Storage.", uploadError);
        return null;
    }
    const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
        console.error("ERRO: Não foi possível obter a URL pública do arquivo no Supabase.");
        return null;
    }
    return publicUrlData.publicUrl;
}

// -----------------------------------------------------------------------------
// INÍCIO DA INTEGRAÇÃO DA STELLA (NOVAS FUNÇÕES)
// -----------------------------------------------------------------------------

// Função para ENVIAR uma resposta de texto para o WhatsApp
async function sendTextMessage(config, to, text) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.whatsapp_permanent_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("ERRO ao enviar mensagem de texto via WhatsApp:", errorData);
            return false;
        }
        console.log(`INFO: Resposta de texto enviada para ${to}`);
        return true;
    } catch (error) {
        console.error("ERRO INESPERADO ao enviar mensagem de texto:", error);
        return false;
    }
}

// Função para ENVIAR um documento (PDF) para o WhatsApp
async function sendDocumentMessage(config, to, documentUrl, caption, filename) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "document",
        document: {
            link: documentUrl,
            caption: caption,
            filename: filename
        }
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.whatsapp_permanent_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("ERRO ao enviar documento via WhatsApp:", errorData);
            return false;
        }
        console.log(`INFO: Documento enviado para ${to}: ${filename}`);
        return true;
    } catch (error) {
        console.error("ERRO INESPERADO ao enviar documento:", error);
        return false;
    }
}


// O CÉREBRO DA STELLA: Processa a mensagem e decide o que fazer
async function processStellaLogic(supabase, config, messageText, senderPhone) {
    const texto = messageText.toLowerCase();
    const palavras = texto.split(' ');

    // 1. Tentar extrair um ID de empreendimento da mensagem
    let empreendimentoId = null;
    for (const palavra of palavras) {
        if (!isNaN(parseInt(palavra))) {
            empreendimentoId = parseInt(palavra);
            break;
        }
    }

    // 2. Verificar a intenção do usuário
    const querInfo = texto.includes('info') || texto.includes('informações');
    const querBook = texto.includes('book') || texto.includes('apresentação');
    const querTabela = texto.includes('tabela');

    // Se não houver ID, não podemos fazer nada.
    if (!empreendimentoId) {
        const resposta = "Olá! Sou a Stella. Para que eu possa te ajudar, por favor, inclua o código do empreendimento no seu pedido. 😉";
        await sendTextMessage(config, senderPhone, resposta);
        return;
    }

    // Busca os dados do empreendimento para usar nas respostas
    const { data: empreendimento, error: empError } = await supabase
        .from('empreendimentos')
        .select('*')
        .eq('id', empreendimentoId)
        .single();
    
    if (empError || !empreendimento) {
        const resposta = "Não encontrei um empreendimento com este código. Poderia verificar, por favor?";
        await sendTextMessage(config, senderPhone, resposta);
        return;
    }

    // 3. Executar a ação baseada na intenção

    // Se pediu o BOOK
    if (querBook) {
        const { data: anexo, error } = await supabase
            .from('empreendimento_anexos')
            .select('public_url, nome_arquivo')
            .eq('empreendimento_id', empreendimentoId)
            .eq('categoria_aba', 'marketing')
            .like('nome_arquivo', '%book%') // Tenta achar um arquivo com "book" no nome
            .limit(1)
            .single();

        if (anexo) {
            await sendDocumentMessage(config, senderPhone, anexo.public_url, `Aqui está o book do ${empreendimento.nome}!`, anexo.nome_arquivo);
        } else {
            await sendTextMessage(config, senderPhone, `Peço desculpas, mas não encontrei o book de apresentação para o ${empreendimento.nome} no momento.`);
        }
        return;
    }

    // Se pediu a TABELA DE VENDAS
    if (querTabela) {
        const { data: anexo, error } = await supabase
            .from('empreendimento_anexos')
            .select('public_url, nome_arquivo')
            .eq('empreendimento_id', empreendimentoId)
            .like('nome_arquivo', '%tabela%') // Tenta achar um arquivo com "tabela" no nome
            .limit(1)
            .single();
        
        if (anexo) {
            await sendDocumentMessage(config, senderPhone, anexo.public_url, `Conforme solicitado, segue a tabela de vendas do ${empreendimento.nome}.`, anexo.nome_arquivo);
        } else {
            await sendTextMessage(config, senderPhone, `Que pena! Não localizei a tabela de vendas para o ${empreendimento.nome} agora.`);
        }
        return;
    }

    // Se pediu INFORMAÇÕES GERAIS
    if (querInfo) {
        const resposta = `
Claro! Seguem as informações sobre o *${empreendimento.nome}*:

*Status:* ${empreendimento.status || 'Não informado'}
*Localização:* ${empreendimento.address_street || ''}, ${empreendimento.neighborhood || ''} - ${empreendimento.city || ''}
${empreendimento.descricao_curta || ''}

Posso te enviar o *book* de apresentação ou a *tabela* de vendas?
        `.trim().replace(/^ +/gm, ''); // Remove espaços extras

        await sendTextMessage(config, senderPhone, resposta);
        return;
    }

    // Se não entendeu, envia uma resposta padrão
    const respostaPadrao = `Olá! Sou a Stella. Recebi sua mensagem sobre o empreendimento ${empreendimento.nome}. Como posso te ajudar? Você gostaria de *informações*, do *book* ou da *tabela de vendas*?`;
    await sendTextMessage(config, senderPhone, respostaPadrao);
}


// -----------------------------------------------------------------------------
// WEBHOOK PRINCIPAL (GET e POST)
// -----------------------------------------------------------------------------

export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("INFO: Webhook verificado com sucesso!");
        return new NextResponse(challenge, { status: 200 });
    }
    console.error("ERRO: Falha na verificação do webhook. Tokens não correspondem.");
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const body = await request.json();
        console.log("INFO: Payload recebido:", JSON.stringify(body, null, 2));

        const { data: whatsappConfig, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id')
            .limit(1).single();

        if (configError || !whatsappConfig) {
            console.error("ERRO CRÍTICO: Não foi possível buscar as configurações do WhatsApp no banco.", configError);
            return new NextResponse(null, { status: 200 }); // Retorna 200 para o WhatsApp não ficar reenviando
        }
        
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (messageEntry) {
            // Se a mensagem for de mídia, processa e obtém a URL pública.
            if (['audio', 'image', 'video', 'document'].includes(messageEntry.type)) {
                const publicUrl = await handleMediaMessage(supabaseAdmin, whatsappConfig, messageEntry);
                if (publicUrl) {
                    messageEntry[messageEntry.type].link = publicUrl;
                }
            }

            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            
            // Lógica para salvar a mensagem no banco (seu código original)
            let contactId = null;
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones && matchingPhones.length > 0) {
                contactId = matchingPhones[0].contato_id;
            }
            
            const messageToSave = {
                contato_id: contactId,
                message_id: messageEntry.id,
                sender_id: messageEntry.from,
                receiver_id: messageEntry.to,
                content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered',
                raw_payload: messageEntry,
            };
            
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);
            if (dbError) console.error("ERRO ao salvar mensagem no banco:", dbError);

            // ----- CHAMADA PARA A LÓGICA DA STELLA -----
            // Se a mensagem for de texto, passamos para a IA decidir o que fazer.
            if (messageContent && messageEntry.type === 'text') {
                // Usamos 'await' para garantir que a lógica da IA execute antes de terminar a função.
                await processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber);
            }
        }
        
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}