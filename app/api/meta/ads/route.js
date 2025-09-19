// app/api/meta/ads/route.js

import { NextResponse } from 'next/server';

/**
 * Esta função é o nosso "Garçom". Ela é acionada sempre que a nossa página de anúncios
 * precisa dos dados mais recentes da Meta.
 */
export async function GET(request) {
    // 1. Pegamos as credenciais segredos do nosso "cofre" (as variáveis de ambiente)
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    // 2. Verificação de segurança: Se as credenciais não estiverem lá, não podemos continuar.
    if (!accessToken || !adAccountId) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente da Meta (META_PAGE_ACCESS_TOKEN ou META_AD_ACCOUNT_ID) não encontradas!");
        return NextResponse.json(
            { error: 'As credenciais da API da Meta não estão configuradas corretamente no servidor.' },
            { status: 500 }
        );
    }

    // 3. Montamos o "pedido" para a Meta:
    //    - Dizemos quais campos queremos: nome, status, status efetivo e, o mais importante,
    //      o nome e o objetivo da campanha associada a cada anúncio.
    const fields = 'name,status,effective_status,campaign{name,objective}';
    const url = `https://graph.facebook.com/v20.0/${adAccountId}/ads?fields=${fields}&access_token=${accessToken}`;

    // 4. Usamos um 'try...catch' para garantir que, se algo der errado na comunicação
    //    com a Meta, nosso sistema não quebre e nos avise do erro.
    try {
        console.log(`LOG: Buscando anúncios da conta ${adAccountId}...`);
        
        // Fazemos a chamada para a API da Meta
        const response = await fetch(url);
        const data = await response.json();

        // 5. Se a Meta nos retornar um erro, nós o registramos e avisamos a página.
        if (!response.ok) {
            console.error("LOG: Erro ao buscar dados da Meta API:", data.error);
            throw new Error(data.error?.message || 'Falha ao se comunicar com a API da Meta.');
        }

        // 6. Se tudo deu certo, entregamos os dados para a página que pediu.
        console.log(`LOG: Sucesso! ${data.data?.length || 0} anúncios encontrados.`);
        return NextResponse.json(data.data || []); // Retorna a lista de anúncios

    } catch (error) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro na API de busca de anúncios:', error);
        return NextResponse.json(
            { error: error.message || 'Ocorreu um erro inesperado no servidor.' },
            { status: 500 }
        );
    }
}