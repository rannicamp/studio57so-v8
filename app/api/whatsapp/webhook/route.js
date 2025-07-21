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
// ***** INÍCIO DA CORREÇÃO *****
// -----------------------------------------------------------------------------

// Função para ENVIAR uma resposta de texto e SALVAR no banco
async function sendTextMessage(supabase, config, to, contactId, text) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` },
        body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    if (!response.ok) {
        console.error("ERRO ao enviar mensagem de texto via WhatsApp:", responseData);
        return false;
    }

    // Após enviar com sucesso, SALVA a mensagem no banco
    const messageId = responseData.messages?.[0]?.id;
    if (messageId) {
        await supabase.from('whatsapp_messages').insert({
            contato_id: contactId,
            message_id: messageId,
            sender_id: config.whatsapp_phone_number_id,
            receiver_id: to,
            content: text,
            sent_at: new Date().toISOString(),
            direction: 'outbound',
            status: 'sent',
            raw_payload: payload
        });
    }
    console.log(`INFO: Resposta de texto enviada para ${to} e salva no banco.`);
    return true;
}

// Função para ENVIAR um documento e SALVAR no banco
async function sendDocumentMessage(supabase, config, to, contactId, documentUrl, caption, filename) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "document",
        document: { link: documentUrl, caption: caption, filename: filename }
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` },
        body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    if (!response.ok) {
        console.error("ERRO ao enviar documento via WhatsApp:", responseData);
        return false;
    }
    
    // Após enviar com sucesso, SALVA a mensagem no banco
    const messageId = responseData.messages?.[0]?.id;
    if (messageId) {
        await supabase.from('whatsapp_messages').insert({
            contato_id: contactId,
            message_id: messageId,
            sender_id: config.whatsapp_phone_number_id,
            receiver_id: to,
            content: caption || filename,
            sent_at: new Date().toISOString(),
            direction: 'outbound',
            status: 'sent',
            raw_payload: payload
        });
    }
    console.log(`INFO: Documento enviado para ${to} e salvo no banco.`);
    return true;
}

// O CÉREBRO DA STELLA: Agora recebe o contactId para poder salvar as respostas
async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    const texto = messageText.toLowerCase();
    const palavras = texto.split(' ');
    let empreendimentoId = null;
    for (const palavra of palavras) { if (!isNaN(parseInt(palavra))) { empreendimentoId = parseInt(palavra); break; } }

    const querInfo = texto.includes('info') || texto.includes('informações');
    const querBook = texto.includes('book') || texto.includes('apresentação');
    const querTabela = texto.includes('tabela');

    if (!empreendimentoId) {
        const resposta = "Olá! Sou a Stella. Para que eu possa te ajudar, por favor, inclua o código do empreendimento no seu pedido. 😉";
        await sendTextMessage(supabase, config, senderPhone, contactId, resposta);
        return;
    }

    const { data: empreendimento, error: empError } = await supabase.from('empreendimentos').select('*').eq('id', empreendimentoId).single();
    if (empError || !empreendimento) {
        const resposta = "Não encontrei um empreendimento com este código. Poderia verificar, por favor?";
        await sendTextMessage(supabase, config, senderPhone, contactId, resposta);
        return;
    }

    if (querBook) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('public_url, nome_arquivo').eq('empreendimento_id', empreendimentoId).eq('categoria_aba', 'marketing').like('nome_arquivo', '%book%').limit(1).single();
        if (anexo) { await sendDocumentMessage(supabase, config, senderPhone, contactId, anexo.public_url, `Aqui está o book do ${empreendimento.nome}!`, anexo.nome_arquivo); } 
        else { await sendTextMessage(supabase, config, senderPhone, contactId, `Peço desculpas, mas não encontrei o book de apresentação para o ${empreendimento.nome} no momento.`); }
        return;
    }

    if (querTabela) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('public_url, nome_arquivo').eq('empreendimento_id', empreendimentoId).like('nome_arquivo', '%tabela%').limit(1).single();
        if (anexo) { await sendDocumentMessage(supabase, config, senderPhone, contactId, anexo.public_url, `Conforme solicitado, segue a tabela de vendas do ${empreendimento.nome}.`, anexo.nome_arquivo); } 
        else { await sendTextMessage(supabase, config, senderPhone, contactId, `Que pena! Não localizei a tabela de vendas para o ${empreendimento.nome} agora.`); }
        return;
    }

    if (querInfo) {
        const resposta = `Olá! Sou a Stella e tenho as informações que você pediu sobre o empreendimento *${empreendimento.nome}*! 🏡\n\n*Status:* ${empreendimento.status || 'Não informado'}\n*Localização:* ${empreendimento.address_street || ''}, ${empreendimento.neighborhood || ''} - ${empreendimento.city || ''}\n\n${empreendimento.descricao_curta || 'Este é um excelente empreendimento com ótimas características.'}\n\nPosso ajudar com mais alguma coisa, como o *book* de apresentação ou a *tabela* de vendas?`.trim();
        await sendTextMessage(supabase, config, senderPhone, contactId, resposta);
        return;
    }

    const respostaPadrao = `Olá! Sou a Stella. Recebi sua mensagem sobre o empreendimento ${empreendimento.nome}. Como posso te ajudar? Você gostaria de *informações*, do *book* ou da *tabela de vendas*?`;
    await sendTextMessage(supabase, config, senderPhone, contactId, respostaPadrao);
}

// -----------------------------------------------------------------------------
// ***** FIM DA CORREÇÃO *****
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

        const { data: whatsappConfig, error: configError } = await supabaseAdmin.from('configuracoes_whatsapp').select('whatsapp_permanent_token, whatsapp_phone_number_id').limit(1).single();
        if (configError || !whatsappConfig) {
            console.error("ERRO CRÍTICO: Não foi possível buscar as configurações do WhatsApp no banco.", configError);
            return new NextResponse(null, { status: 200 });
        }
        
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            if (['audio', 'image', 'video', 'document'].includes(messageEntry.type)) {
                const publicUrl = await handleMediaMessage(supabaseAdmin, whatsappConfig, messageEntry);
                if (publicUrl) { messageEntry[messageEntry.type].link = publicUrl; }
            }

            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contactId = null;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones && matchingPhones.length > 0) {
                contactId = matchingPhones[0].contato_id;
            }
            
            const messageToSave = {
                contato_id: contactId, message_id: messageEntry.id, sender_id: messageEntry.from,
                receiver_id: messageEntry.to, content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: messageEntry,
            };
            
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);
            if (dbError) console.error("ERRO ao salvar mensagem no banco:", dbError);

            // ***** INÍCIO DA CORREÇÃO *****
            // Se for uma mensagem de texto, passamos para a IA decidir o que fazer.
            // AGORA, passamos também o contactId encontrado.
            if (messageContent && messageEntry.type === 'text') {
                await processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
            // ***** FIM DA CORREÇÃO *****
        }
        
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}