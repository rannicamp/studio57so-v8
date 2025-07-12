// app/api/whatsapp/send/route.js

import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();
    const { to, type, templateName, languageCode, components, text } = body;

    // Log inicial para sabermos que a função foi chamada
    console.log("Iniciando /api/whatsapp/send...");

    if (!to || !type) {
        return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
    }

    const { data: config, error: configError } = await supabase
        .from('configuracoes_whatsapp')
        .select('whatsapp_permanent_token, whatsapp_phone_number_id')
        .limit(1)
        .single();

    if (configError || !config) {
        console.error("ERRO GRAVE: Não foi possível ler as configurações do WhatsApp no banco de dados.", configError);
        return NextResponse.json({ error: 'As credenciais do WhatsApp não foram encontradas no banco de dados.' }, { status: 500 });
    }

    const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID } = config;

    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    let payload = {};
    let messageContent = '';

    if (type === 'template') {
        payload = {
            messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'template',
            template: { name: templateName, language: { code: languageCode || 'pt_BR' }, components: components || [] }
        };
        messageContent = `Template: ${templateName}`;
    } else if (type === 'text') {
        payload = {
            messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'text',
            text: { preview_url: true, body: text }
        };
        messageContent = text;
    } else {
         return NextResponse.json({ error: 'Tipo de mensagem inválido.' }, { status: 400 });
    }

    try {
        console.log("Enviando payload para a API da Meta:", JSON.stringify(payload, null, 2));
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();
        console.log("Resposta recebida da API da Meta:", JSON.stringify(responseData, null, 2));
        
        if (!apiResponse.ok) {
            console.error("API da Meta retornou um erro:", responseData);
            return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
        }
        
        const newMessageId = responseData.messages?.[0]?.id;
        if (!newMessageId) {
            console.error("API retornou sucesso, mas o ID da mensagem não foi encontrado na resposta.");
            return NextResponse.json({ message: 'Mensagem enviada, mas não pôde ser salva (ID ausente).', data: responseData }, { status: 200 });
        }

        console.log(`Sucesso! ID da mensagem recebido: ${newMessageId}. Tentando salvar no banco...`);

        const { data: contact } = await supabase.from('contatos').select('id, enterprise_id').eq('whatsapp', to).single();

        const messageToSave = {
            contact_id: contact?.id || null, enterprise_id: contact?.enterprise_id || null,
            message_id: newMessageId, sender_id: 'SYSTEM', receiver_id: to, content: messageContent,
            sent_at: new Date().toISOString(), direction: 'OUT', status: 'SENT', message_type: type,
            raw_payload: responseData,
        };

        const { error: dbError } = await supabase.from('whatsapp_messages').insert(messageToSave);

        if (dbError) {
            console.error('ERRO AO INSERIR NO BANCO:', dbError);
            return NextResponse.json({ message: 'Mensagem ENVIADA, mas falhou ao salvar no banco.', error: dbError.message }, { status: 206 });
        }

        console.log("Mensagem salva no banco com sucesso!");
        return NextResponse.json({ message: 'Mensagem enviada e salva com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error("Erro inesperado na rota de envio:", error);
        return NextResponse.json({ error: 'Falha crítica ao se comunicar com a API do WhatsApp.' }, { status: 500 });
    }
}