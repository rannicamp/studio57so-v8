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

const getTodaysSpend = async (adAccountId, accessToken) => {
    const insightsUrl = `https://graph.facebook.com/v20.0/${adAccountId}/insights?level=ad&fields=ad_id,spend&date_preset=today&limit=500&access_token=${accessToken}`;
    try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        if (data.error) {
            console.error("LOG: [API Anúncios] Erro ao buscar gasto diário:", data.error.message);
            return new Map();
        }
        const spendMap = new Map();
        (data.data || []).forEach(insight => {
            spendMap.set(insight.ad_id, parseFloat(insight.spend || 0));
        });
        return spendMap;
    } catch (error) {
        console.error("LOG: [API Anúncios] Falha na requisição de gasto diário:", error.message);
        return new Map();
    }
};

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Variáveis de ambiente do servidor não configuradas.' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);

        const { data: empresa, error: empresaError } = await supabase.from('cadastro_empresa').select('meta_business_id').not('meta_business_id', 'is', null).limit(1).single();
        if (empresaError || !empresa) {
            throw new Error("Nenhuma empresa com 'meta_business_id' configurado foi encontrada.");
        }

        const metaBusinessId = empresa.meta_business_id;
        const adAccountsUrl = `https://graph.facebook.com/v20.0/${metaBusinessId}/owned_ad_accounts?access_token=${PAGE_ACCESS_TOKEN}`;
        const adAccountsResponse = await fetch(adAccountsUrl);
        const adAccountsData = await adAccountsResponse.json();
        if (!adAccountsResponse.ok || !adAccountsData.data || adAccountsData.data.length === 0) {
            throw new Error(adAccountsData.error?.message || "Nenhuma conta de anúncios encontrada.");
        }
        const adAccountId = adAccountsData.data[0].id;
        
        const statusFilter = searchParams.get('status');
        const campaignIdsFilter = searchParams.get('campaign_ids');
        const adsetIdsFilter = searchParams.get('adset_ids');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let filters = [];
        if (statusFilter) {
            filters.push({ field: 'effective_status', operator: 'IN', value: statusFilter.split(',') });
        }
        if (campaignIdsFilter) {
            filters.push({ field: 'campaign.id', operator: 'IN', value: campaignIdsFilter.split(',') });
        }
        if (adsetIdsFilter) {
            filters.push({ field: 'adset.id', operator: 'IN', value: adsetIdsFilter.split(',') });
        }

        const filteringParam = filters.length > 0 ? `&filtering=${JSON.stringify(filters)}` : '';
        
        // =================================================================================
        // O PORQUÊ da alteração aqui:
        // Por padrão, a API da Meta retorna dados dos últimos 28 dias se não especificarmos
        // um período. Para atender ao seu pedido de carregar TODOS os dados históricos
        // na visualização inicial, agora usamos `insights.date_preset('maximum')` quando
        // nenhum filtro de data é aplicado. Quando o usuário filtra, usamos o `time_range`
        // normalmente. Isso garante que a visão geral seja sempre completa.
        // =================================================================================
        let insightsRequest;
        const insightsFields = '{spend,impressions,clicks,reach,frequency,cpm,ctr,cpc,actions,cost_per_action_type}';

        if (startDate && endDate) {
            // Se o usuário filtrou por data, usamos o período que ele pediu.
            insightsRequest = `insights.time_range({'since':'${startDate}','until':'${endDate}'})${insightsFields}`;
        } else {
            // Caso contrário, pedimos à Meta o período máximo de dados.
            insightsRequest = `insights.date_preset(maximum)${insightsFields}`;
        }

        const allFields = `name,effective_status,end_time,created_time,campaign{id,name,objective,buying_type,spend_cap},adset{id,name,start_time,end_time,daily_budget,lifetime_budget,billing_event},creative{title,body,image_url,thumbnail_url,video_id},${insightsRequest}`;
        
        const baseUrl = `https://graph.facebook.com/v20.0/${adAccountId}/ads`;
        const adsUrl = `${baseUrl}?fields=${allFields.replace(/\s/g, '')}${filteringParam}&limit=100&access_token=${PAGE_ACCESS_TOKEN}`;

        const [adsResponse, todaysSpendMap] = await Promise.all([
            fetch(adsUrl),
            getTodaysSpend(adAccountId, PAGE_ACCESS_TOKEN)
        ]);

        const adsData = await adsResponse.json();
        
        if (adsData.error) {
            throw new Error(adsData.error?.message || "Falha ao buscar dados na API da Meta.");
        }

        const formattedAds = (adsData.data || []).map(ad => {
            const insights = ad.insights?.data[0];
            const actions = insights?.actions || [];
            const costPerAction = insights?.cost_per_action_type || [];
            const leadAction = actions.find(a => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(a.action_type));
            const costPerLeadAction = costPerAction.find(c => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(c.action_type));

            return {
                id: ad.id,
                name: ad.name,
                status: ad.effective_status,
                created_time: ad.created_time,
                end_time: ad.end_time || ad.adset?.end_time || null,
                creative_title: ad.creative?.title,
                creative_body: ad.creative?.body,
                thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url,
                campaign_id: ad.campaign?.id,
                campaign_name: ad.campaign?.name,
                campaign_objective: ad.campaign?.objective,
                campaign_buying_type: ad.campaign?.buying_type,
                adset_id: ad.adset?.id,
                adset_name: ad.adset?.name,
                adset_daily_budget: ad.adset?.daily_budget,
                adset_lifetime_budget: ad.adset?.lifetime_budget,
                spend: insights?.spend || '0.00',
                impressions: insights?.impressions || 0,
                clicks: insights?.clicks || 0,
                reach: insights?.reach || 0,
                frequency: insights?.frequency || 0,
                cpm: insights?.cpm || 0,
                ctr: insights?.ctr || 0,
                cpc: insights?.cpc || 0,
                leads: leadAction ? parseInt(leadAction.value) : 0,
                cost_per_lead: costPerLeadAction ? parseFloat(costPerLeadAction.value) : 0,
                spend_today: todaysSpendMap.get(ad.id) || 0,
            }
        });
        
        return NextResponse.json(formattedAds);

    } catch (error) {
        console.error("LOG: [API Anúncios] ERRO GERAL:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}