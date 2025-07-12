import { NextResponse } from 'next/server';
// O caminho correto para o seu projeto, verificado.
import { createClient } from '../../../../utils/supabase/server';

export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();
    const { to, type, templateName, languageCode, components, text } = body;

    if (!to || !type) {
        return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
    }

    const { data: config, error: configError } = await supabase
        .from('configuracoes_whatsapp')
        .select('whatsapp_permanent_token, whatsapp_phone_number_id')
        .limit(1)
        .single();

    if (configError || !config) {
        console.error("ERRO AO BUSCAR CONFIGURAÇÃO:", configError);
        return NextResponse.json({ error: 'As credenciais do WhatsApp não foram encontradas ou não puderam ser lidas no banco de dados. Verifique o Passo 2 da solução (Permissões RLS).' }, { status: 500 });
    }

    const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID } = config;

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        return NextResponse.json({ error: 'As credenciais do WhatsApp estão incompletas no banco de dados. Verifique a tela de Integrações.' }, { status: 500 });
    }

    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    let payload = {};

    if (type === 'template') {
        if (!templateName) {
            return NextResponse.json({ error: 'O nome do modelo (templateName) é obrigatório.' }, { status: 400 });
        }
        payload = {
            messaging_product: 'whatsapp', to: to, type: 'template',
            template: { name: templateName, language: { code: languageCode || 'pt_BR' }, components: components }
        };
    } else if (type === 'text') {
        if (!text) {
             return NextResponse.json({ error: 'O conteúdo (text) é obrigatório.' }, { status: 400 });
        }
        payload = {
            messaging_product: 'whatsapp', to: to, type: 'text',
            text: { preview_url: true, body: text }
        };
    } else {
         return NextResponse.json({ error: 'Tipo de mensagem inválido.' }, { status: 400 });
    }

    try {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();
        if (!apiResponse.ok) {
            return NextResponse.json({ error: responseData.error?.message || 'Erro da API do WhatsApp.' }, { status: apiResponse.status });
        }
        return NextResponse.json({ message: 'Mensagem enviada com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: 'Falha ao se comunicar com a API do WhatsApp.' }, { status: 500 });
    }
}