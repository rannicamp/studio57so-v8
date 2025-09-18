// app/api/meta/anuncios/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para obter o cliente Supabase com a chave de admin (segura no servidor)
const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        console.error("API Anuncios: Variáveis de ambiente do Supabase não encontradas.");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

// A rota GET que nossa página vai chamar para buscar os anúncios
export async function GET(request) {
    console.log("LOG: [API Anúncios] Requisição recebida para buscar anúncios ativos.");

    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ 
            error: 'Variáveis de ambiente do servidor não configuradas corretamente.' 
        }, { status: 500 });
    }

    try {
        // 1. Descobrir a conta de anúncios associada à sua empresa no sistema.
        const { data: empresa, error: empresaError } = await supabase
            .from('cadastro_empresa')
            .select('meta_business_id')
            .not('meta_business_id', 'is', null)
            .limit(1)
            .single();

        if (empresaError || !empresa) {
            throw new Error("Nenhuma empresa com 'meta_business_id' configurado foi encontrada no sistema.");
        }

        const metaBusinessId = empresa.meta_business_id;
        console.log(`LOG: [API Anúncios] Usando Meta Business ID: ${metaBusinessId}`);

        // 2. Usar o ID do negócio para pedir à Meta as contas de anúncio associadas.
        const adAccountsUrl = `https://graph.facebook.com/v20.0/${metaBusinessId}/owned_ad_accounts?access_token=${PAGE_ACCESS_TOKEN}`;
        const adAccountsResponse = await fetch(adAccountsUrl);
        const adAccountsData = await adAccountsResponse.json();

        if (!adAccountsResponse.ok || !adAccountsData.data || adAccountsData.data.length === 0) {
            throw new Error(adAccountsData.error?.message || "Nenhuma conta de anúncios encontrada para este negócio.");
        }

        const adAccountId = adAccountsData.data[0].id;
        console.log(`LOG: [API Anúncios] Usando a conta de anúncios ID: ${adAccountId}`);

        // =================================================================================
        // INÍCIO DA CORREÇÃO
        // O PORQUÊ: Trocamos o campo de filtro de "status" para "effective_status",
        // que é o campo correto que a API da Meta aceita para filtrar pelo status real
        // de veiculação de um anúncio.
        // =================================================================================
        const adsUrl = `https://graph.facebook.com/v20.0/${adAccountId}/ads?fields=name,effective_status,adcreatives{thumbnail_url,image_url,video_id},insights{spend}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&access_token=${PAGE_ACCESS_TOKEN}`;
        // =================================================================================
        // FIM DA CORREÇÃO
        // =================================================================================
        
        console.log(`LOG: [API Anúncios] Consultando a Meta para buscar anúncios...`);
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (!adsResponse.ok) {
            throw new Error(adsData.error?.message || "Falha ao buscar anúncios na Meta.");
        }
        
        // Também vamos ajustar o que retornamos para usar o 'effective_status' que pedimos
        const adsWithCorrectStatus = adsData.data.map(ad => ({ ...ad, status: ad.effective_status }));

        console.log(`LOG: [API Anúncios] ${adsWithCorrectStatus.length} anúncios ativos encontrados.`);
        
        return NextResponse.json(adsWithCorrectStatus);

    } catch (error) {
        console.error("LOG: [API Anúncios] ERRO GERAL:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}