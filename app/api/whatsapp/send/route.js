import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        // ADICIONADO: custom_content para salvar o texto real do template
        const { to, type, text, link, caption, filename, templateName, languageCode, components, contact_id, custom_content } = body;

        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada no banco.' }, { status: 500 });
        }

        const token = config.whatsapp_permanent_token;
        const phoneId = config.whatsapp_phone_number_id;

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
            // AQUI ESTÁ A MÁGICA: Se vier o texto pronto, usa ele. Se não, usa o nome.
            messageContentForDb = custom_content || `Template: ${templateName}`;
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

        const newMessageId = responseData.messages?.[0]?.id;

        if (newMessageId) {
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
                contato_id: finalContactId,
                message_id: newMessageId,
                sender_id: phoneId,
                receiver_id: to,
                content: messageContentForDb, // Agora salva o texto bonito
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: JSON.stringify(payload),
                organizacao_id: config.organizacao_id,
                media_url: link || null
            });

            if (dbError) console.error('[WhatsApp Send] Erro DB:', dbError);
        }

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}