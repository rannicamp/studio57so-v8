// app/api/whatsapp/templates/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    const supabaseAdmin = getSupabaseAdmin();

    try {
        // 1. Busca as configurações do WhatsApp no seu banco de dados
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_business_account_id')
            .limit(1)
            .single();

        if (configError || !config) {
            console.error('Erro ao buscar credenciais do WhatsApp:', configError);
            return NextResponse.json({ error: 'Credenciais do WhatsApp não encontradas.' }, { status: 500 });
        }

        const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_business_account_id: WHATSAPP_BUSINESS_ACCOUNT_ID } = config;

        // Verifica se o ID da conta de negócios está configurado
        if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
            return NextResponse.json({ error: 'O ID da Conta de Negócios do WhatsApp (whatsapp_business_account_id) não está configurado na tabela de configurações.' }, { status: 500 });
        }

        // 2. Monta a URL para a API da Meta
        const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;

        // 3. Faz a chamada para a API da Meta para buscar os modelos
        const apiResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            },
        });

        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Erro da API do WhatsApp ao buscar templates:', responseData);
            return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
        }

        // 4. Filtra apenas os modelos que estão APROVADOS
        const approvedTemplates = responseData.data.filter(template => template.status === 'APPROVED');

        // 5. Retorna a lista de modelos aprovados para o front-end
        return NextResponse.json(approvedTemplates);

    } catch (error) {
        console.error('Falha crítica ao buscar modelos de mensagem:', error);
        return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
    }
}