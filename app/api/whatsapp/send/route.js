import { NextResponse } from 'next/server';

export async function POST(request) {
    const body = await request.json();
    const { to, type, templateName, languageCode, components, text } = body;

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!to || !type) {
        return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
    }

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        return NextResponse.json({ error: 'As credenciais do WhatsApp não estão configuradas no servidor.' }, { status: 500 });
    }

    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    let payload = {};

    // LÓGICA ATUALIZADA: Monta o payload baseado no tipo de mensagem
    if (type === 'template') {
        if (!templateName) {
            return NextResponse.json({ error: 'O nome do modelo (templateName) é obrigatório para mensagens do tipo template.' }, { status: 400 });
        }
        payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: languageCode || 'pt_BR'
                },
                components: components
            }
        };
    } else if (type === 'text') {
        if (!text) {
             return NextResponse.json({ error: 'O conteúdo do texto (text) é obrigatório para mensagens do tipo texto.' }, { status: 400 });
        }
        payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                preview_url: true, // Permite que links na mensagem gerem uma pré-visualização
                body: text
            }
        };
    } else {
         return NextResponse.json({ error: 'Tipo de mensagem inválido. Use "template" ou "text".' }, { status: 400 });
    }

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