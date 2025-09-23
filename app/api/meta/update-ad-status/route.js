// app/api/meta/update-ad-status/route.js

import { NextResponse } from 'next/server';

// O PORQUÊ: Esta API é o nosso "mensageiro". Ela recebe um pedido do nosso sistema
// (com o ID do anúncio e o novo status), e o repassa para a API oficial da Meta
// de forma segura, usando nosso token de acesso do servidor.

export async function POST(request) {
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Token de acesso da Meta não configurado no servidor.' }, { status: 500 });
    }

    try {
        // 1. Lemos as informações que nosso sistema enviou: ID do anúncio e o novo status.
        const { adId, newStatus } = await request.json();

        if (!adId || !newStatus) {
            return NextResponse.json({ error: 'ID do anúncio e novo status são obrigatórios.' }, { status: 400 });
        }

        // 2. Montamos a URL e os dados para o pedido à Meta.
        const url = `https://graph.facebook.com/v20.0/${adId}`;
        const body = new URLSearchParams({
            'status': newStatus,
            'access_token': PAGE_ACCESS_TOKEN
        });

        // 3. Enviamos a ordem para a Meta.
        const metaResponse = await fetch(url, {
            method: 'POST',
            body: body,
        });

        const metaResponseData = await metaResponse.json();

        // 4. Verificamos se a Meta aceitou a ordem.
        if (!metaResponse.ok) {
            // Se deu erro, repassamos a mensagem de erro da Meta.
            throw new Error(metaResponseData.error?.message || 'Falha ao atualizar status na API da Meta.');
        }

        // 5. Se deu tudo certo, avisamos nosso sistema.
        return NextResponse.json({ success: true, data: metaResponseData });

    } catch (error) {
        console.error("LOG: [API Update Ad Status] ERRO:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}