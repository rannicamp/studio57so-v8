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
    console.log("LOG: [API Anúncios] Requisição recebida para buscar anúncios.");

    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ 
            error: 'Variáveis de ambiente do servidor não configuradas corretamente.' 
        }, { status: 500 });
    }

    try {
        // MANTIVEMOS SUA LÓGICA INTELIGENTE AQUI:
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
        // INÍCIO DA NOSSA MELHORIA ✨
        // O PORQUÊ: Agora, a API pode receber um "pedido" da página com os status
        // que queremos ver. Ex: /api/meta/anuncios?status=ACTIVE,PAUSED
        // =================================================================================
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status'); // Pegamos os status da URL

        let filteringParam = ''; // Começamos com o filtro vazio

        if (statusFilter) {
            // Se a página pediu status específicos, montamos o filtro
            const statusValues = statusFilter.split(',').map(s => `"${s.trim()}"`).join(',');
            filteringParam = `&filtering=[{"field":"effective_status","operator":"IN","value":[${statusValues}]}]`;
            console.log(`LOG: [API Anúncios] Aplicando filtro de status: [${statusFilter}]`);
        } else {
            console.log(`LOG: [API Anúncios] Nenhum filtro de status aplicado. Buscando todos os anúncios.`);
        }

        const fields = 'name,campaign{name,objective},effective_status,adcreatives{thumbnail_url,image_url,video_id},insights{spend,impressions,clicks,ctr,cpc}';
        const baseUrl = `https://graph.facebook.com/v20.0/${adAccountId}/ads`;
        const adsUrl = `${baseUrl}?fields=${fields}${filteringParam}&access_token=${PAGE_ACCESS_TOKEN}`;
        // =================================================================================
        // FIM DA MELHORIA
        // =================================================================================
        
        console.log(`LOG: [API Anúncios] Consultando a Meta para buscar anúncios...`);
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (!adsResponse.ok) {
            throw new Error(adsData.error?.message || "Falha ao buscar anúncios na Meta.");
        }
        
        const formattedAds = (adsData.data || []).map(ad => ({
            id: ad.id,
            name: ad.name,
            status: ad.effective_status,
            spend: ad.insights?.data[0]?.spend || '0.00',
            impressions: ad.insights?.data[0]?.impressions || 0,
            clicks: ad.insights?.data[0]?.clicks || 0,
            ctr: ad.insights?.data[0]?.ctr || '0.00',
            cpc: ad.insights?.data[0]?.cpc || '0.00',
            campaign_name: ad.campaign?.name,
            campaign_objective: ad.campaign?.objective,
            thumbnail_url: ad.adcreatives?.data[0]?.thumbnail_url || ad.adcreatives?.data[0]?.image_url,
        }));

        console.log(`LOG: [API Anúncios] ${formattedAds.length} anúncios encontrados.`);
        
        return NextResponse.json(formattedAds);

    } catch (error) {
        console.error("LOG: [API Anúncios] ERRO GERAL:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}