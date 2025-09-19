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
        const { searchParams } = new URL(request.url);

        // Filtro de Status (já existente)
        const statusFilter = searchParams.get('status');
        let filteringParam = '';
        if (statusFilter) {
            const statusValues = statusFilter.split(',').map(s => `"${s.trim()}"`).join(',');
            filteringParam = `&filtering=[{"field":"effective_status","operator":"IN","value":[${statusValues}]}]`;
        }

        // =================================================================================
        // MUDANÇA AQUI: Adicionando o filtro de data ✨
        // Pegamos as datas da URL e montamos o parâmetro 'time_range' que a Meta entende.
        // =================================================================================
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        let timeRangeParam = '';
        if (startDate && endDate) {
            timeRangeParam = `&time_range={'since':'${startDate}','until':'${endDate}'}`;
        }

        const fields = 'name,campaign{name,objective},effective_status,end_time,adcreatives{thumbnail_url,image_url},insights{spend,impressions,clicks,actions,cost_per_action_type}';
        const baseUrl = `https://graph.facebook.com/v20.0/${adAccountId}/ads`;
        const adsUrl = `${baseUrl}?fields=${fields}${filteringParam}${timeRangeParam}&access_token=${PAGE_ACCESS_TOKEN}`;

        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (!adsResponse.ok) {
            throw new Error(adsData.error?.message || "Falha ao buscar anúncios na Meta.");
        }
        
        const formattedAds = (adsData.data || []).map(ad => {
            const insights = ad.insights?.data[0];
            const actions = insights?.actions || [];
            const costPerAction = insights?.cost_per_action_type || [];
            const leadAction = actions.find(a => ['lead', 'onsite_conversion.lead'].includes(a.action_type));
            const costPerLeadAction = costPerAction.find(c => ['lead', 'onsite_conversion.lead'].includes(c.action_type));

            return {
                id: ad.id, name: ad.name, status: ad.effective_status, end_time: ad.end_time || null,
                spend: insights?.spend || '0.00', impressions: insights?.impressions || 0, clicks: insights?.clicks || 0,
                leads: leadAction ? parseInt(leadAction.value) : 0, cost_per_lead: costPerLeadAction ? parseFloat(costPerLeadAction.value) : 0,
                campaign_name: ad.campaign?.name, campaign_objective: ad.campaign?.objective,
                thumbnail_url: ad.adcreatives?.data[0]?.thumbnail_url || ad.adcreatives?.data[0]?.image_url,
            }
        });
        
        return NextResponse.json(formattedAds);

    } catch (error) {
        console.error("LOG: [API Anúncios] ERRO GERAL:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}