import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        // AGORA RECEBEMOS contact_id PARA GARANTIR O VÍNCULO CORRETO
        const { to, type, text, link, caption, filename, templateName, languageCode, components, contact_id } = body;

        // Busca o token no banco
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada no banco.' }, { status: 500 });
        }

        const token = config.whatsapp_permanent_token;
        const phoneId = config.whatsapp_phone_number_id;

        // Prepara o pacote para a Meta
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: type
        };

        let messageContentForDb = '';

        if (type === 'text') {
            payload.text = { body: text, preview_url: true };
            messageContentForDb = text;
        } 
        else if (type === 'template') {
            payload.template = {
                name: templateName,
                language: { code: languageCode || 'pt_BR' },
                components: components || []
            };
            messageContentForDb = `Template: ${templateName}`;
        } 
        else if (type === 'image') {
            payload.image = { link: link, caption: caption || '' };
            messageContentForDb = caption || 'Imagem enviada';
        } 
        else if (type === 'document') {
            payload.document = { link: link, caption: caption || '', filename: filename || 'documento.pdf' };
            messageContentForDb = caption || filename || 'Documento enviado';
        } 
        else if (type === 'audio') {
            payload.audio = { link: link };
            messageContentForDb = 'Áudio enviado';
        } 
        else if (type === 'video') {
            payload.video = { link: link, caption: caption || '' };
            messageContentForDb = caption || 'Vídeo enviado';
        }

        console.log(`[WhatsApp Send] Enviando ${type} para ${to}...`);

        // Envia para a API da Meta
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('[WhatsApp Send Error] Resposta da Meta:', JSON.stringify(responseData));
            return NextResponse.json({ 
                error: responseData.error?.message || 'Erro ao enviar mensagem na Meta API',
                details: responseData 
            }, { status: response.status });
        }

        // Sucesso! Agora salvamos no banco
        const newMessageId = responseData.messages?.[0]?.id;

        if (newMessageId) {
            // LÓGICA BLINDADA: Se veio o ID do contato, usa ele. Se não, tenta adivinhar.
            let finalContactId = contact_id;

            if (!finalContactId) {
                try {
                    const { data } = await supabaseAdmin.rpc('find_contact_by_phone', { phone_input: to });
                    finalContactId = data;
                } catch (e) {
                    console.warn("Falha ao buscar contato por telefone:", e);
                }
            }

            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId, // Usa o ID garantido
                message_id: newMessageId,
                sender_id: phoneId,
                receiver_id: to,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: JSON.stringify(payload),
                organizacao_id: config.organizacao_id,
                media_url: link || null
            });

            if (dbError) {
                console.error('[WhatsApp Send] Erro ao salvar mensagem no banco:', dbError);
            }
        }

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}