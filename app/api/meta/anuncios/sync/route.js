// app/api/meta/anuncios/sync/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

async function fetchAllFromMeta(initialUrl, organizacaoId, supabase) {
    let allData = [];
    let nextUrl = initialUrl;

    while (nextUrl) {
        const response = await fetch(nextUrl);
        const data = await response.json();

        if (!response.ok) {
            console.error("Erro na API da Meta:", data.error);
            throw new Error(data.error?.message || 'Falha ao buscar dados da Meta');
        }

        const rawAds = data.data || [];
        
        if (rawAds.length > 0) {
            allData = allData.concat(rawAds);

            const campaignsToUpsert = [...new Map(rawAds.map(ad => [ad.campaign.id, { id: ad.campaign.id, name: ad.campaign.name, objective: ad.campaign.objective, status: ad.campaign.status, account_id: ad.account_id, organizacao_id: organizacaoId }])).values()];
            const adsetsToUpsert = [...new Map(rawAds.map(ad => [ad.adset.id, { id: ad.adset.id, name: ad.adset.name, campaign_id: ad.campaign.id, status: ad.adset.status, organizacao_id: organizacaoId }])).values()];
            const adsToUpsert = rawAds.map(ad => {
                const insights = ad.insights?.data[0] || {};
                const leadAction = insights.actions?.find(a => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(a.action_type));
                const leads = leadAction ? parseInt(leadAction.value, 10) : 0;
                const spend = parseFloat(insights.spend || 0);
                return {
                    id: ad.id, name: ad.name, adset_id: ad.adset.id, campaign_id: ad.campaign.id, status: ad.effective_status, thumbnail_url: ad.creative?.thumbnail_url, created_time: ad.created_time,
                    insights: { spend: spend, impressions: parseInt(insights.impressions || 0), clicks: parseInt(insights.clicks || 0), reach: parseInt(insights.reach || 0), leads: leads, cost_per_lead: leads > 0 ? (spend / leads) : 0, },
                    organizacao_id: organizacaoId,
                };
            });
            
            const historicoToInsert = rawAds.map(ad => {
                const insights = ad.insights?.data[0] || {};
                const leadAction = insights.actions?.find(a => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(a.action_type));
                const snapshotDate = new Date().toLocaleDateString('en-CA');

                return {
                    ad_id: ad.id,
                    ad_name: ad.name,
                    campaign_name: ad.campaign?.name,
                    adset_name: ad.adset?.name,
                    spend: parseFloat(insights.spend || 0),
                    impressions: parseInt(insights.impressions || 0),
                    clicks: parseInt(insights.clicks || 0),
                    reach: parseInt(insights.reach || 0),
                    leads: leadAction ? parseInt(leadAction.value, 10) : 0,
                    organizacao_id: organizacaoId,
                    data_snapshot: snapshotDate,
                };
            });

            await supabase.from('meta_campaigns').upsert(campaignsToUpsert);
            await supabase.from('meta_adsets').upsert(adsetsToUpsert);
            await supabase.from('meta_ads').upsert(adsToUpsert);
            
            try {
                const { error: historicoError } = await supabase
                    .from('meta_ads_historico')
                    .insert(historicoToInsert);

                if (historicoError) throw historicoError;
                
                console.log("LOG: Registros de histórico inseridos com sucesso!");
            } catch (error) {
                console.error("\n--- [DEBUG] ERRO AO INSERIR NA TABELA meta_ads_historico ---", error);
            }
        }
        
        nextUrl = data.paging?.next;
    }
    return allData;
}

export async function GET(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    if (!PAGE_ACCESS_TOKEN) return NextResponse.json({ error: 'Token de acesso da Meta não configurado.' }, { status: 500 });

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: profile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 });

        const { data: empresas, error: empresasError } = await supabase.from('cadastro_empresa').select('meta_business_id').eq('organizacao_id', profile.organizacao_id);
        if (empresasError) throw empresasError;

        const empresaComBusinessId = empresas.find(e => e.meta_business_id);
        if (!empresaComBusinessId) return NextResponse.json({ error: 'ID do Gerenciador de Negócios não configurado.' }, { status: 404 });
        
        const metaBusinessId = empresaComBusinessId.meta_business_id;
        
        const adAccountsUrl = `${BASE_URL}/${metaBusinessId}/owned_ad_accounts?fields=id,account_id&limit=1&access_token=${PAGE_ACCESS_TOKEN}`;
        const adAccountsResponse = await fetch(adAccountsUrl);
        const adAccountsData = await adAccountsResponse.json();
        const adAccountId = adAccountsData.data?.[0]?.id;
        if (!adAccountId) return NextResponse.json({ error: 'Nenhuma conta de anúncios ativa encontrada.' }, { status: 404 });

        const allFields = 'name,effective_status,created_time,account_id,campaign{id,name,objective,status},adset{id,name,status},creative{thumbnail_url},insights{spend,impressions,clicks,reach,actions}';
        const initialUrl = `${BASE_URL}/${adAccountId}/ads?fields=${allFields}&date_preset=maximum&limit=50&access_token=${PAGE_ACCESS_TOKEN}`;

        const syncedData = await fetchAllFromMeta(initialUrl, profile.organizacao_id, supabase);

        // O PORQUÊ DA MUDANÇA:
        // Exatamente aqui! Após a sincronização principal terminar, nós automaticamente
        // chamamos a função de preenchimento que criamos. Isso garante que qualquer
        // registro que por acaso tenha sido salvo sem os nomes seja corrigido na hora.
        console.log("LOG: Sincronização concluída. Executando função de preenchimento de nomes...");
        const { data: rpcData, error: rpcError } = await supabase.rpc('preencher_nomes_historico_anuncios');

        if (rpcError) {
            // Apenas registramos o erro, mas não paramos o processo.
            // A sincronização principal foi um sucesso.
            console.error("ERRO ao executar a função de preenchimento de nomes:", rpcError);
        } else {
            console.log(`LOG: Função de preenchimento executada. Resultado: ${rpcData}`);
        }

        return NextResponse.json({
            message: `Sincronização concluída! ${syncedData.length} anúncios foram processados.`,
            count: syncedData.length
        });

    } catch (error) {
        console.error('Erro na API de sincronização:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}