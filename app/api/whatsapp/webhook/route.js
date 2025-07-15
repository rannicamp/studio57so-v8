// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para extrair o conteúdo de texto da complexa resposta do WhatsApp
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

// Função para normalizar e gerar variações de números de telefone para busca
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

// ----- INÍCIO DA CORREÇÃO PRINCIPAL -----
// Função para buscar a mídia no WhatsApp, fazer o upload no Supabase e retornar a URL pública
async function handleMediaMessage(supabase, whatsappConfig, message) {
    const mediaId = message.image?.id || message.video?.id || message.document?.id || message.audio?.id;
    if (!mediaId) {
        console.warn("WARN: Mensagem de mídia recebida, mas sem ID.", message);
        return null;
    }

    // 1. Pegar a URL da mídia na API do WhatsApp
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

    // 2. Baixar o arquivo de mídia
    const mediaFileResponse = await fetch(mediaUrl, {
        headers: { 'Authorization': `Bearer ${whatsappConfig.whatsapp_permanent_token}` }
    });
    if (!mediaFileResponse.ok) {
        console.error("ERRO: Falha ao baixar a mídia da URL fornecida pelo WhatsApp.");
        return null;
    }
    const mediaBuffer = await mediaFileResponse.arrayBuffer();

    // 3. Fazer o upload para o Supabase Storage
    const fileName = message.document?.filename || `${message.type}_${mediaId}.${mediaMimeType.split('/')[1] || 'bin'}`;
    const contactId = message.from; // Usaremos o número do contato para organizar as pastas
    const filePath = `${contactId}/${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, mediaBuffer, { contentType: mediaMimeType });

    if (uploadError) {
        console.error("ERRO: Falha ao fazer upload da mídia para o Supabase Storage.", uploadError);
        return null;
    }

    // 4. Obter a URL pública do arquivo que acabamos de salvar
    const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
        console.error("ERRO: Não foi possível obter a URL pública do arquivo no Supabase.");
        return null;
    }

    // 5. Retorna a URL pública para ser salva no payload da mensagem
    return publicUrlData.publicUrl;
}

// ----- FIM DA CORREÇÃO PRINCIPAL -----

export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
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
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const body = await request.json();
        console.log("INFO: Payload recebido do webhook:", JSON.stringify(body, null, 2));

        const { data: whatsappConfig, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id')
            .limit(1).single();

        if (configError || !whatsappConfig) {
            console.error("ERRO ao buscar configurações do WhatsApp:", configError);
            return new NextResponse(null, { status: 200 });
        }
        
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (messageEntry) {
            // Se a mensagem for de mídia (imagem, áudio, etc.), busca o link real antes de continuar
            if (['audio', 'image', 'video', 'document'].includes(messageEntry.type)) {
                const publicUrl = await handleMediaMessage(supabaseAdmin, whatsappConfig, messageEntry);
                if (publicUrl) {
                    // Adiciona o link público ao objeto de mídia no payload, para que ele seja salvo no banco
                    messageEntry[messageEntry.type].link = publicUrl;
                }
            }

            const messageContent = getTextContent(messageEntry);
            const messageId = messageEntry.id;
            const timestamp = new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString();
            const contactPhoneNumber = messageEntry.from;
            let contactId = null;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);

            if (matchingPhones && matchingPhones.length > 0) {
                contactId = matchingPhones[0].contato_id;
            }
            
            const messageToSave = {
                contato_id: contactId,
                message_id: messageId,
                sender_id: messageEntry.from,
                receiver_id: messageEntry.to,
                content: messageContent,
                sent_at: timestamp,
                direction: 'inbound', // Toda mensagem que chega no webhook é uma mensagem de entrada
                status: 'delivered', // A mensagem foi entregue ao nosso sistema
                raw_payload: messageEntry,
            };
            
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);
            if (dbError) console.error("ERRO ao salvar mensagem no banco:", dbError);

        }
        
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}