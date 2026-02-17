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
        
        // Desestruturação dos dados recebidos
        let { to, type, text, link, caption, filename, template, templateName, languageCode, components, contact_id, custom_content, location } = body;

        // --- 1. LIMPEZA E VALIDAÇÃO DO TELEFONE ---
        const cleanPhone = to ? to.toString().replace(/\D/g, '') : '';

        if (!cleanPhone) {
            return NextResponse.json({ error: 'Número de telefone inválido ou vazio.' }, { status: 400 });
        }

        // --- 2. CONFIGURAÇÃO ---
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada no banco.' }, { status: 500 });
        }

        const token = config.whatsapp_permanent_token;
        const phoneId = config.whatsapp_phone_number_id;

        // --- 3. PREPARAÇÃO DO PAYLOAD PARA META ---
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: type
        };

        // Define o conteúdo textual para salvar no banco depois
        let messageContentForDb = '';

        if (type === 'text') {
            payload.text = { body: text, preview_url: true };
            messageContentForDb = text;
        } 
        // --- CORREÇÃO AQUI: FILTRAGEM RIGOROSA PARA A META ---
        else if (type === 'template') {
            if (template && template.name) {
                // A Meta SÓ aceita estas 3 chaves. Qualquer outra (como fullText) causa erro 100.
                payload.template = {
                    name: template.name,
                    language: template.language, // Deve ser um objeto { code: '...' }
                    components: template.components || []
                };
                
                // Usamos o fullText AQUI para o banco, mas não mandamos no payload da Meta
                messageContentForDb = custom_content || template.fullText || `Template: ${template.name}`;
            } 
            else {
                // Fallback para o modo antigo
                payload.template = {
                    name: templateName,
                    language: { code: languageCode || 'pt_BR' },
                    components: components || []
                };
                messageContentForDb = custom_content || `Template: ${templateName}`;
            }
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
        else if (type === 'location') {
            payload.location = {
                latitude: location.latitude,
                longitude: location.longitude,
                name: location.name || 'Localização',
                address: location.address || ''
            };
            messageContentForDb = `📍 Localização: ${location.latitude}, ${location.longitude}`;
        }

        console.log(`[WhatsApp Send] Enviando ${type} para ${cleanPhone}...`);

        // --- 4. TENTATIVA DE ENVIO (META API) ---
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        // --- 5. RESOLUÇÃO DO CONTATO ---
        let finalContactId = contact_id;
        if (!finalContactId) {
            try {
                const { data } = await supabaseAdmin.rpc('find_contact_smart', { phone_input: cleanPhone });
                finalContactId = data;
            } catch (e) {
                console.warn("Falha ao buscar contato por telefone:", e);
            }
        }

        // --- 6. TRATAMENTO DE ERRO ---
        if (!response.ok) {
            console.error('[WhatsApp Send Error] Falha Meta:', JSON.stringify(responseData));
            
            const errorMessage = responseData.error?.message || 'Erro desconhecido na Meta API';
            
            // Salva log de erro no banco
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId,
                sender_id: phoneId,
                receiver_id: cleanPhone,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'failed',
                raw_payload: responseData,
                error_message: errorMessage,
                organizacao_id: config.organizacao_id,
                media_url: link || null
            });

            return NextResponse.json({ 
                error: errorMessage,
                details: responseData 
            }, { status: response.status });
        }

        // --- 7. SUCESSO ---
        const newMessageId = responseData.messages?.[0]?.id;

        if (newMessageId) {
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId,
                message_id: newMessageId,
                sender_id: phoneId,
                receiver_id: cleanPhone,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: JSON.stringify(payload),
                organizacao_id: config.organizacao_id,
                media_url: link || null,
                error_message: null
            });

            if (dbError) console.error('[WhatsApp Send] Erro DB:', dbError);
        }

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}