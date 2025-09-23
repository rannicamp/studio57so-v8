// app/api/meta/update-ad-status/route.js

import { NextResponse } from 'next/server';

export async function POST(request) {
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Token de acesso da Meta não configurado no servidor.' }, { status: 500 });
    }

    try {
        const { adId, newStatus } = await request.json();

        if (!adId || !newStatus) {
            return NextResponse.json({ error: 'ID do anúncio e novo status são obrigatórios.' }, { status: 400 });
        }

        // =================================================================================
        // ALTERAÇÃO PRINCIPAL
        // O PORQUÊ: A API da Meta espera o token de acesso como parte da URL (um 
        // "query parameter"), e não dentro do corpo da requisição. Enviá-lo no corpo
        // causa o erro "Invalid parameter".
        // O QUE FIZEMOS: Adicionamos `?access_token=${PAGE_ACCESS_TOKEN}` diretamente
        // na URL, que é o padrão da indústria e o formato que a Meta espera.
        // =================================================================================
        const url = `https://graph.facebook.com/v20.0/${adId}?access_token=${PAGE_ACCESS_TOKEN}`;
        
        // =================================================================================
        // CORPO DA REQUISIÇÃO SIMPLIFICADO
        // O PORQUÊ: Agora que o token está na URL, o corpo da requisição precisa conter
        // apenas os dados que queremos modificar, neste caso, o 'status'.
        // =================================================================================
        const body = new URLSearchParams({
            'status': newStatus,
        });

        // Nossos espiões (debug) continuam aqui para nos ajudar se necessário
        console.log("\n--- [DEBUG] TENTANDO ATUALIZAR STATUS DO ANÚNCIO (VERSÃO CORRIGIDA) ---");
        console.log("URL de Destino:", url);
        console.log("ID do Anúncio Recebido (adId):", adId);
        console.log("Novo Status Recebido (newStatus):", newStatus);
        console.log("Corpo da Requisição Enviado (body):", body.toString());
        console.log("----------------------------------------------------------------------\n");

        const metaResponse = await fetch(url, {
            method: 'POST',
            body: body,
        });

        const metaResponseData = await metaResponse.json();

        if (!metaResponse.ok) {
            console.error("--- [DEBUG] ERRO DA API DA META ---");
            console.error(JSON.stringify(metaResponseData, null, 2));
            console.error("-----------------------------------");
            throw new Error(metaResponseData.error?.message || 'Falha ao atualizar status na API da Meta.');
        }

        return NextResponse.json({ success: true, data: metaResponseData });

    } catch (error) {
        console.error("LOG: [API Update Ad Status] ERRO GERAL:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}