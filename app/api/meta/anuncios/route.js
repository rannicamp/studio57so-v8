// app/api/meta/anuncios/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        console.error("API Anuncios: Variáveis de ambiente do Supabase não encontradas.");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Variáveis de ambiente do servidor não configuradas.' }, { status: 500 });
    }

    try {
        const { data: empresa, error: empresaError } = await supabase
            .from('cadastro_empresa')
            .select('meta_business_id, organizacao_id')
            .not('meta_business_id', 'is', null)
            .limit(1)
            .single();

        if (empresaError || !empresa) {
            throw new Error("Nenhuma empresa com 'meta_business_id' configurado foi encontrada.");
        }
        
        const metaBusinessId = empresa.meta_business_id;
        const organizacaoId = empresa.organizacao_id;

        const adAccountsUrl = `https://graph.facebook.com/v20.0/${metaBusinessId}/owned_ad_accounts?access_token=${PAGE_ACCESS_TOKEN}`;
        const adAccountsResponse = await fetch(adAccountsUrl);
        const adAccountsData = await adAccountsResponse.json();
        if (!adAccountsResponse.ok || !adAccountsData.data || adAccountsData.data.length === 0) {
            throw new Error(adAccountsData.error?.message || "Nenhuma conta de anúncios encontrada.");
        }
        const adAccountId = adAccountsData.data[0].id;

        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        let adsUrl;

        if (cursor) {
            adsUrl = cursor;
        } else {
            // =================================================================================
            // MUDANÇA PRINCIPAL: REMOVEMOS TODOS OS FILTROS
            // O PORQUÊ: Para garantir que estamos buscando absolutamente tudo, removemos
            // o parâmetro `filtering`. A API agora trará todos os anúncios,
            // independentemente do status (Ativo, Pausado, Arquivado, etc.).
            // Aumentamos também o limite para 100 para pegar mais dados de uma vez.
            // =================================================================================
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            let insightsRequest = 'insights{spend,impressions,clicks,reach,frequency,actions}';
            if (startDate && endDate) {
                insightsRequest = `insights.time_range({'since':'${startDate}','until':'${endDate}'}){spend,impressions,clicks,reach,frequency,actions}`;
            }

            const allFields = `name,effective_status,campaign{id,name,objective,status},adset{id,name,status,daily_budget,lifetime_budget},creative{thumbnail_url},${insightsRequest}`;
            const baseUrl = `https://graph.facebook.com/v20.0/${adAccountId}/ads`;
            adsUrl = `${baseUrl}?fields=${allFields.replace(/\s/g, '')}&limit=100&access_token=${PAGE_ACCESS_TOKEN}`;
        }

        console.log("LOG: Buscando na URL da Meta:", adsUrl.replace(PAGE_ACCESS_TOKEN, '******'));
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();
        
        if (adsData.error) {
            throw new Error(adsData.error?.message || "Falha ao buscar dados na API da Meta.");
        }

        const rawAds = adsData.data || [];

        if (rawAds.length > 0) {
            console.log(`LOG: Sincronizando ${rawAds.length} anúncios com o banco de dados...`);

            const campaignsToUpsert = [...new Map(rawAds.map(ad => [ad.campaign.id, {
                id: ad.campaign.id,
                name: ad.campaign.name,
                objective: ad.campaign.objective,
                status: ad.campaign.status,
                account_id: adAccountId,
                organizacao_id: organizacaoId,
            }])).values()];

            const adsetsToUpsert = [...new Map(rawAds.map(ad => [ad.adset.id, {
                id: ad.adset.id,
                name: ad.adset.name,
                campaign_id: ad.campaign.id,
                status: ad.adset.status,
                daily_budget: ad.adset.daily_budget ? parseInt(ad.adset.daily_budget, 10) : null,
                lifetime_budget: ad.adset.lifetime_budget ? parseInt(ad.adset.lifetime_budget, 10) : null,
                organizacao_id: organizacaoId,
            }])).values()];

            const adsToUpsert = rawAds.map(ad => ({
                id: ad.id,
                name: ad.name,
                adset_id: ad.adset.id,
                campaign_id: ad.campaign.id,
                status: ad.effective_status,
                thumbnail_url: ad.creative?.thumbnail_url,
                organizacao_id: organizacaoId,
            }));
            
            console.log(`LOG: Salvando ${campaignsToUpsert.length} campanhas...`);
            const { error: campaignError } = await supabase.from('meta_campaigns').upsert(campaignsToUpsert);
            if (campaignError) console.error("Erro ao sincronizar campanhas:", campaignError.message);

            console.log(`LOG: Salvando ${adsetsToUpsert.length} conjuntos de anúncios...`);
            const { error: adsetError } = await supabase.from('meta_adsets').upsert(adsetsToUpsert);
            if (adsetError) console.error("Erro ao sincronizar conjuntos de anúncios:", adsetError.message);
            
            console.log(`LOG: Salvando ${adsToUpsert.length} anúncios...`);
            const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert);
            if (adError) console.error("Erro ao sincronizar anúncios:", adError.message);

            console.log("LOG: Sincronização com o banco de dados concluída.");
        } else {
             console.log("LOG: Nenhum anúncio encontrado na Meta para os filtros atuais.");
        }

        const formattedAds = rawAds.map(ad => {
            const insights = ad.insights?.data[0];
            const leadAction = insights?.actions?.find(a => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(a.action_type));
            const leads = leadAction ? parseInt(leadAction.value) : 0;
            const spend = parseFloat(insights?.spend || 0);
            const costPerLead = leads > 0 ? (spend / leads).toFixed(2) : '0.00';

            return {
                id: ad.id,
                name: ad.name,
                status: ad.effective_status,
                thumbnail_url: ad.creative?.thumbnail_url,
                campaign_name: ad.campaign?.name,
                valor_gasto: spend.toFixed(2),
                alcance: parseInt(insights?.reach || 0),
                impressoes: parseInt(insights?.impressions || 0),
                frequencia: parseFloat(insights?.frequency || 0).toFixed(2),
                leads: leads,
                custo_p_lead: costPerLead,
            };
        });
        
        const nextPageCursor = adsData.paging?.next || null;

        return NextResponse.json({
            ads: formattedAds,
            nextPageCursor: nextPageCursor
        });

    } catch (error) {
        console.error("LOG: [API Anúncios] ERRO GERAL:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}