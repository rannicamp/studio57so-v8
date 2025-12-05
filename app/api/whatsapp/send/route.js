// app/api/whatsapp/send/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta (Faltam chaves do Supabase)." }, { status: 500 });
    }

    // Usamos o Service Key para ter permissão total de admin (buscar configs e inserir mensagens)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        const { to, type, templateName, languageCode, components, text, link, filename, caption } = body;

        if (!to || !type) {
            return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
        }

        // 1. Busca Credenciais na tabela 'configuracoes_whatsapp'
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id, organizacao_id')
            .limit(1)
            .single();

        if (configError || !config) {
            console.error("Erro ao buscar configs do Whats:", configError);
            return NextResponse.json({ error: 'Credenciais do WhatsApp não encontradas no banco.' }, { status: 500 });
        }

        const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID, organizacao_id } = config;
        
        // 2. Prepara Payload do WhatsApp
        const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        // Estrutura base padrão
        let payload = { 
            messaging_product: 'whatsapp', 
            recipient_type: "individual",
            to: to, 
            type: type 
        };
        
        let messageContentForDb = '';
        
        switch (type) {
            case 'text':
                payload.text = { preview_url: true, body: text };
                messageContentForDb = text;
                break;
                
            case 'document':
                if (!link) return NextResponse.json({ error: 'Link é obrigatório para documentos.' }, { status: 400 });
                payload.document = { 
                    link: link, 
                    filename: filename || 'Arquivo',
                    // Caption é opcional para documentos, mas vamos passar se existir
                    ...(caption && { caption: caption })
                };
                messageContentForDb = caption || filename || 'Documento enviado';
                break;
                
            case 'image':
                if (!link) return NextResponse.json({ error: 'Link é obrigatório para imagens.' }, { status: 400 });
                payload.image = { 
                    link: link, 
                    ...(caption && { caption: caption }) 
                };
                messageContentForDb = caption || 'Imagem enviada';
                break;
                
            case 'video':
                if (!link) return NextResponse.json({ error: 'Link é obrigatório para vídeos.' }, { status: 400 });
                payload.video = { 
                    link: link, 
                    ...(caption && { caption: caption }) 
                };
                messageContentForDb = caption || 'Vídeo enviado';
                break;
                
            case 'audio':
                if (!link) return NextResponse.json({ error: 'Link é obrigatório para áudio.' }, { status: 400 });
                payload.audio = { 
                    link: link 
                    // Áudio no Whatsapp não suporta caption
                };
                messageContentForDb = 'Áudio enviado';
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
                return NextResponse.json({ error: 'Tipo de mensagem inválido.' }, { status: 400 });
        }

        console.log("Enviando payload para Meta:", JSON.stringify(payload, null, 2));

        // 3. Envia para a API da Meta
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Erro da Meta:', responseData);
            return NextResponse.json({ 
                error: `Erro WhatsApp: ${responseData.error?.message}`,
                details: responseData 
            }, { status: apiResponse.status });
        }

        const newMessageId = responseData.messages?.[0]?.id;

        // 4. Salva no Banco
        if (newMessageId) {
            // Tenta encontrar o contato para vincular
            let contactId = null;
            try {
                const { data } = await supabaseAdmin.rpc('find_contact_by_phone', { phone_input: to });
                contactId = data;
            } catch (e) {
                console.warn("RPC find_contact_by_phone falhou ou não existe:", e);
            }

            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contactId, 
                message_id: newMessageId,
                sender_id: WHATSAPP_PHONE_NUMBER_ID,
                receiver_id: to,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: JSON.stringify(payload),
                organizacao_id: organizacao_id,
                // AQUI ESTÁ A CORREÇÃO IMPORTANTE:
                // Salvamos o link na coluna dedicada para facilitar a exibição no front
                media_url: link || null 
            });

            if (dbError) {
                console.error('Erro ao salvar no banco (mas mensagem foi enviada):', dbError);
            }
        }

        return NextResponse.json({ message: 'Enviado com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error('Falha crítica no route.js:', error);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}