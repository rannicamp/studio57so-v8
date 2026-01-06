//app\api\whatsapp\send\route.js

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
        let { to, type, text, link, caption, filename, templateName, languageCode, components, contact_id, custom_content } = body;

        // --- 1. LIMPEZA E VALIDAÇÃO DO TELEFONE ---
        // Remove tudo que não for dígito (remove +, -, espaço, parênteses)
        // Para EUA (DDI 1), Brasil (DDI 55), etc, ficará apenas os números.
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
            to: cleanPhone, // Usa o número limpo
            type: type
        };

        // Define o conteúdo textual para salvar no banco depois
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

        console.log(`[WhatsApp Send] Enviando ${type} para ${cleanPhone}...`);

        // --- 4. TENTATIVA DE ENVIO (META API) ---
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        // --- 5. RESOLUÇÃO DO CONTATO (Para salvar no banco, sucesso ou erro) ---
        let finalContactId = contact_id;
        if (!finalContactId) {
            try {
                // Tenta achar o contato pelo telefone limpo
                const { data } = await supabaseAdmin.rpc('find_contact_smart', { phone_input: cleanPhone });
                finalContactId = data;
            } catch (e) {
                console.warn("Falha ao buscar contato por telefone:", e);
            }
        }

        // --- 6. TRATAMENTO DE ERRO (Se falhar na Meta) ---
        if (!response.ok) {
            console.error('[WhatsApp Send Error] Falha Meta:', JSON.stringify(responseData));
            
            // AQUI ESTÁ A MÁGICA QUE VOCÊ PEDIU:
            // Salva o erro no banco ao invés de só retornar 500
            const errorMessage = responseData.error?.message || 'Erro desconhecido na Meta API';
            const errorPayload = responseData; // O JSON completo do erro

            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId,
                sender_id: phoneId,
                receiver_id: cleanPhone,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'failed', // Status de falha
                raw_payload: errorPayload, // JSON completo do erro no raw_payload
                error_message: errorMessage, // Mensagem legível na coluna de erro
                organizacao_id: config.organizacao_id,
                media_url: link || null
            });

            // Retorna o erro para quem chamou a API também saber
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
                raw_payload: JSON.stringify(payload), // No sucesso, salvamos o que enviamos
                organizacao_id: config.organizacao_id,
                media_url: link || null,
                error_message: null // Sem erro
            });

            if (dbError) console.error('[WhatsApp Send] Erro DB:', dbError);
        }

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        
        // Tenta salvar até erro de código/servidor se possível (opcional, mas recomendado)
        // Isso é um "try/catch" de segurança máxima
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}