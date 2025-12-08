import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    // Verifica credenciais do Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor (Supabase) incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        const { to, type, text, link, caption, filename, templateName, languageCode, components } = body;

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

        // Monta o corpo específico para cada tipo
        if (type === 'text') {
            payload.text = { body: text };
        } 
        else if (type === 'template') {
            payload.template = {
                name: templateName,
                language: { code: languageCode || 'pt_BR' },
                components: components || []
            };
        } 
        else if (type === 'image') {
            payload.image = { link: link, caption: caption || '' };
        } 
        else if (type === 'document') {
            payload.document = { link: link, caption: caption || '', filename: filename || 'documento.pdf' };
        } 
        else if (type === 'audio') {
            // TRUQUE: Áudios precisam ser públicos e acessíveis
            payload.audio = { link: link };
        } 
        else if (type === 'video') {
            payload.video = { link: link, caption: caption || '' };
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

        // Sucesso! Retorna o ID da mensagem gerado pela Meta
        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}