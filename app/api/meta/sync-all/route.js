// app/api/meta/sync-all/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export async function GET(request) {
    console.log("LOG: [SYNC-ALL] Iniciando Sincronização Inteligente a partir dos anúncios existentes.");
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: profile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 });
        const organizacaoId = profile.organizacao_id;

        const { data: empresa } = await supabase.from('cadastro_empresa').select('meta_business_id').eq('organizacao_id', organizacaoId).not('meta_business_id', 'is', null).limit(1).single();
        if (!empresa || !empresa.meta_business_id) {
            throw new Error("ID do Gerenciador de Negócios (meta_business_id) não configurado.");
        }

        const adAccountsResponse = await fetch(`${BASE_URL}/${empresa.meta_business_id}/owned_ad_accounts?access_token=${PAGE_ACCESS_TOKEN}`);
        const adAccountsData = await adAccountsResponse.json();
        if (!adAccountsResponse.ok || !adAccountsData.data || adAccountsData.data.length === 0) {
            throw new Error(adAccountsData.error?.message || "Nenhuma conta de anúncios encontrada.");
        }
        const adAccountId = adAccountsData.data[0].id;
        
        console.log(`LOG: [SYNC-ALL] Usando conta de anúncios: ${adAccountId}`);

        const allFields = 'name,campaign{id,name,objective},adset{id,name,campaign_id}';
        const adsUrl = `${BASE_URL}/${adAccountId}/ads?fields=${allFields.replace(/\s/g, '')}&limit=1000&access_token=${PAGE_ACCESS_TOKEN}`;

        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();
        if (adsData.error) throw new Error(adsData.error.message);

        const allAds = adsData.data || [];
        if (allAds.length === 0) return NextResponse.json({ message: "Nenhum anúncio encontrado para sincronizar." });
        
        console.log(`LOG: [SYNC-ALL] ${allAds.length} anúncios encontrados na Meta. Sincronizando tabelas...`);

        // Estruturas para evitar duplicatas
        const campaignsToUpsert = new Map();
        const adsetsToUpsert = new Map();
        const adsToUpsert = [];

        for (const ad of allAds) {
            if (ad.campaign) {
                campaignsToUpsert.set(ad.campaign.id, {
                    id: ad.campaign.id,
                    name: ad.campaign.name,
                    objective: ad.campaign.objective,
                    organizacao_id: organizacaoId,
                    account_id: adAccountId.replace('act_', '')
                });
            }
            if (ad.adset) {
                adsetsToUpsert.set(ad.adset.id, {
                    id: ad.adset.id,
                    name: ad.adset.name,
                    campaign_id: ad.adset.campaign_id,
                    organizacao_id: organizacaoId
                });
            }
            adsToUpsert.push({
                id: ad.id,
                name: ad.name,
                campaign_id: ad.campaign?.id,
                adset_id: ad.adset?.id,
                organizacao_id: organizacaoId
            });
        }

        // Executa as operações no banco de dados
        const { error: campError } = await supabase.from('meta_campaigns').upsert(Array.from(campaignsToUpsert.values()));
        if (campError) throw new Error(`Falha ao sincronizar campanhas: ${campError.message}`);

        const { error: adsetError } = await supabase.from('meta_adsets').upsert(Array.from(adsetsToUpsert.values()));
        if (adsetError) throw new Error(`Falha ao sincronizar conjuntos de anúncios: ${adsetError.message}`);
        
        const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert);
        if (adError) throw new Error(`Falha ao sincronizar anúncios: ${adError.message}`);

        return NextResponse.json({
            message: "Sincronização Inteligente concluída!",
            campaigns: campaignsToUpsert.size,
            adsets: adsetsToUpsert.size,
            ads: adsToUpsert.length
        });

    } catch (error) {
        console.error('ERRO GERAL no /api/meta/sync-all:', error.message);
        return NextResponse.json({ error: 'Ocorreu um erro inesperado.', details: error.message }, { status: 500 });
    }
}