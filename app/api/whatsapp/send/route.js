import { NextResponse } from 'next/server';

export async function POST(request) {
    const { to, templateName, languageCode = 'pt_BR', components } = await request.json();

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!to || !templateName) {
        return NextResponse.json({ error: 'O número de destino (to) e o nome do modelo (templateName) são obrigatórios.' }, { status: 400 });
    }

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        return NextResponse.json({ error: 'As credenciais do WhatsApp não estão configuradas no servidor.' }, { status: 500 });
    }

    // A versão da API foi atualizada para v20.0, mais recente.
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: languageCode
            },
            components: components
        }
    };

    try {
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
            console.error('Erro da API do WhatsApp:', responseData);
            const errorMessage = responseData.error?.message || 'Erro desconhecido da API do WhatsApp.';
            return NextResponse.json({ error: errorMessage }, { status: apiResponse.status });
        }

        return NextResponse.json({ message: 'Mensagem enviada com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error('Erro ao enviar mensagem via WhatsApp:', error);
        return NextResponse.json({ error: 'Falha ao se comunicar com a API do WhatsApp.' }, { status: 500 });
    }
}