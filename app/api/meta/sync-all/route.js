// app/api/meta/sync-all/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Função auxiliar para fazer requisições à API da Meta
async function metaApiRequest(endpoint, params = {}) {
    const urlParams = new URLSearchParams({ ...params, access_token: PAGE_ACCESS_TOKEN });
    const url = `${BASE_URL}/${endpoint}?${urlParams.toString()}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
        console.error(`Erro na chamada para ${endpoint}:`, data.error);
        throw new Error(data.error?.message || `Erro na API da Meta: ${response.statusText}`);
    }
    return data.data || [];
}

export async function GET(request) {
    console.log("LOG: [SYNC-ALL] Processo de sincronização mestre iniciado.");
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        // Segurança: Valida se o usuário está logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: profile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 });
        const organizacaoId = profile.organizacao_id;

        // Encontra a conta de anúncios principal da empresa
        const { data: empresa } = await supabase.from('cadastro_empresa').select('meta_ad_account_id').eq('organizacao_id', organizacaoId).single();
        if (!empresa || !empresa.meta_ad_account_id) {
            throw new Error("ID da Conta de Anúncios não configurado no sistema para esta organização.");
        }
        const adAccountId = empresa.meta_ad_account_id.replace('act_', '');

        // 1. Busca TODAS as campanhas da conta de anúncios
        const campaigns = await metaApiRequest(adAccountId + '/campaigns', { fields: 'id,name', limit: 500 });
        if (campaigns.length > 0) {
            const campaignsToUpsert = campaigns.map(c => ({ id: c.id, name: c.name, organizacao_id: organizacaoId }));
            const { error: campError } = await supabase.from('meta_campaigns').upsert(campaignsToUpsert, { onConflict: 'id' });
            if (campError) throw new Error(`Falha ao sincronizar campanhas: ${campError.message}`);
            console.log(`LOG: [SYNC-ALL] ${campaigns.length} campanhas sincronizadas.`);
        }

        // 2. Busca TODOS os conjuntos de anúncios
        const adsets = await metaApiRequest(adAccountId + '/adsets', { fields: 'id,name,campaign_id', limit: 500 });
        if (adsets.length > 0) {
            const adsetsToUpsert = adsets.map(as => ({ id: as.id, name: as.name, campaign_id: as.campaign_id, organizacao_id: organizacaoId }));
            const { error: adsetError } = await supabase.from('meta_adsets').upsert(adsetsToUpsert, { onConflict: 'id' });
            if (adsetError) throw new Error(`Falha ao sincronizar conjuntos de anúncios: ${adsetError.message}`);
            console.log(`LOG: [SYNC-ALL] ${adsets.length} conjuntos de anúncios sincronizados.`);
        }

        // 3. Busca TODOS os anúncios
        const ads = await metaApiRequest(adAccountId + '/ads', { fields: 'id,name,campaign_id,adset_id', limit: 500 });
        if (ads.length > 0) {
            const adsToUpsert = ads.map(ad => ({ id: ad.id, name: ad.name, campaign_id: ad.campaign_id, adset_id: ad.adset_id, organizacao_id: organizacaoId }));
            const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert, { onConflict: 'id' });
            if (adError) throw new Error(`Falha ao sincronizar anúncios: ${adError.message}`);
            console.log(`LOG: [SYNC-ALL] ${ads.length} anúncios sincronizados.`);
        }

        return NextResponse.json({
            message: "Sincronização Mestre concluída com sucesso!",
            campaigns: campaigns.length,
            adsets: adsets.length,
            ads: ads.length
        });

    } catch (error) {
        console.error('ERRO GERAL no /api/meta/sync-all:', error.message);
        return NextResponse.json({ error: 'Ocorreu um erro inesperado durante a sincronização.', details: error.message }, { status: 500 });
    }
}