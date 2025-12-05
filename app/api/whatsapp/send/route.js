// app/api/whatsapp/send/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        const { to, type, templateName, languageCode, components, text, link, filename, caption } = body;

        if (!to || !type) {
            return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
        }

        // 1. Busca Credenciais
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id, organizacao_id')
            .limit(1)
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Credenciais do WhatsApp não encontradas.' }, { status: 500 });
        }

        const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID, organizacao_id } = config;
        
        // 2. Prepara Payload do WhatsApp
        const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        let payload = { messaging_product: 'whatsapp', to: to, type: type };
        let messageContentForDb = '';
        
        switch (type) {
            case 'text':
                payload.text = { preview_url: true, body: text };
                messageContentForDb = text;
                break;
            case 'document':
                payload.document = { link: link, filename: filename, caption: caption };
                messageContentForDb = caption || filename || 'Documento';
                break;
            case 'image':
                payload.image = { link: link, caption: caption };
                messageContentForDb = caption || 'Imagem';
                break;
            case 'video':
                payload.video = { link: link, caption: caption };
                messageContentForDb = caption || 'Vídeo';
                break;
            case 'audio':
                payload.audio = { link: link };
                messageContentForDb = 'Áudio';
                break;
            case 'template':
                if (!templateName) return NextResponse.json({ error: 'Nome do template obrigatório.' }, { status: 400 });
                payload.template = { 
                    name: templateName, 
                    language: { code: languageCode || 'pt_BR' }, 
                    components: components || [] 
                };
                messageContentForDb = `Template: ${templateName}`;
                break;
            default:
                return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
        }

        // 3. Envia para a API da Meta
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Erro da Meta:', responseData);
            return NextResponse.json({ error: `Erro WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
        }

        const newMessageId = responseData.messages?.[0]?.id;

        // 4. Salva no Banco (USANDO A INTELIGÊNCIA DE CONTATO)
        if (newMessageId) {
            // Usa a função RPC do banco para achar o contato correto (igual ao Webhook)
            const { data: contactId } = await supabaseAdmin.rpc('find_contact_by_phone', { phone_input: to });

            // O Trigger do banco vai cuidar de vincular à conversa correta automaticamente
            // pois estamos inserindo o 'contato_id' correto.
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contactId, // ID correto do contato (ou null se não existir)
                message_id: newMessageId,
                sender_id: WHATSAPP_PHONE_NUMBER_ID,
                receiver_id: to,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: payload,
                organizacao_id: organizacao_id
            });

            if (dbError) {
                console.error('Erro ao salvar no banco:', dbError);
                // Não retornamos erro 500 aqui porque a mensagem JÁ foi enviada pro Zap.
                // Apenas logamos o erro de salvamento.
            }
        }

        return NextResponse.json({ message: 'Enviado com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error('Falha crítica:', error);
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }
}