import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

export async function GET(request) {
  try {
    // 1. A MÁGICA DAS DATAS: Lemos as datas que o painel enviou na URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
    const { data: integracao } = await supabase
      .from('integracoes_meta')
      .select('access_token, ad_account_id')
      .eq('organizacao_id', userData.organizacao_id)
      .single();

    if (!integracao?.access_token) {
      throw new Error('Token do Meta ausente. Por favor, reconecte.');
    }

    if (!integracao?.ad_account_id) {
      throw new Error('Conta de anúncios não selecionada. Configure no menu de integrações.');
    }

    FacebookAdsApi.init(integracao.access_token);
    const adAccountId = integracao.ad_account_id.startsWith('act_') ? integracao.ad_account_id : `act_${integracao.ad_account_id}`;
    const account = new AdAccount(adAccountId);

    // 2. REGRA DE PERÍODO: Se tem data, pede o período exato. Se não tem, pede o 'maximum'
    let insightsField = 'insights.date_preset(maximum){spend,impressions,clicks,reach,actions,cost_per_action_type}';

    if (startDate && endDate) {
      insightsField = `insights.time_range({"since":"${startDate}","until":"${endDate}"}){spend,impressions,clicks,reach,actions,cost_per_action_type}`;
    }

    const fields = [
      'name',
      'status',
      'effective_status',
      'creative{thumbnail_url,image_url}',
      'campaign{id,name}',
      'adset{id,name}',
      insightsField // Injetamos a regra de período certa aqui!
    ];

    const adsData = await account.getAds(fields, { limit: 500 });

    const adsFormatted = adsData.map((ad) => {
      let stat = null;
      if (ad.insights && ad.insights.data && ad.insights.data.length > 0) {
        stat = ad.insights.data[0];
      } else if (ad.insights && ad.insights.length > 0) {
        stat = ad.insights[0];
      }

      const baseAd = {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status || ad.status,
        thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
        campaign_id: ad.campaign?.id,
        campaign_name: ad.campaign?.name || 'Sem Campanha',
        adset_id: ad.adset?.id,
        adset_name: ad.adset?.name || 'Sem Conjunto',
        spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, cost_per_lead: 0, frequencia: 0
      };

      if (stat) {
        const leadAction = stat.actions?.find(a => ['lead', 'form_lead', 'onsite_conversion.lead'].includes(a.action_type));
        const cplAction = stat.cost_per_action_type?.find(a => ['lead', 'form_lead', 'onsite_conversion.lead'].includes(a.action_type));

        baseAd.spend = parseFloat(stat.spend || 0);
        baseAd.impressions = parseInt(stat.impressions || 0);
        baseAd.clicks = parseInt(stat.clicks || 0);
        baseAd.reach = parseInt(stat.reach || 0);
        baseAd.leads = leadAction ? parseInt(leadAction.value) : 0;
        baseAd.cost_per_lead = cplAction ? parseFloat(cplAction.value) : 0;
        baseAd.frequencia = baseAd.reach > 0 ? (baseAd.impressions / baseAd.reach) : 0;
      }

      return baseAd;
    });

    return NextResponse.json({ data: adsFormatted });

  } catch (error) {
    console.error('⚠️ Erro na API do Meta Ads (Ativando Fallback de Banco):', error.message);
    
    // BLINDAGEM DE RATE LIMIT / OFFLINE: Se falhar a comunicação com a API do Facebook,
    // retornamos os anúncios e insights históricos que estão salvos no nosso banco de dados.
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (userData?.organizacao_id) {
          const orgId = userData.organizacao_id;
          
          // Busca anúncios locais no banco
          const { data: localAds } = await supabase
            .from('meta_ads')
            .select('*')
            .eq('organizacao_id', orgId);

          // Busca campanhas e conjuntos de anúncios locais para preencher os nomes
          const { data: localCampaigns } = await supabase
            .from('meta_campaigns')
            .select('id, name')
            .eq('organizacao_id', orgId);

          const { data: localAdsets } = await supabase
            .from('meta_adsets')
            .select('id, name')
            .eq('organizacao_id', orgId);

          const campaignsMap = {};
          if (localCampaigns) localCampaigns.forEach(c => campaignsMap[c.id] = c.name);

          const adsetsMap = {};
          if (localAdsets) localAdsets.forEach(a => adsetsMap[a.id] = a.name);

          const adsFormatted = (localAds || []).map(ad => {
            const insights = ad.insights || {};
            return {
              id: ad.id,
              name: ad.name || 'Anúncio sem nome',
              status: ad.status || 'PAUSED',
              thumbnail_url: ad.thumbnail_url || null,
              campaign_id: ad.campaign_id,
              campaign_name: campaignsMap[ad.campaign_id] || 'Sem Campanha',
              adset_id: ad.adset_id,
              adset_name: adsetsMap[ad.adset_id] || 'Sem Conjunto',
              spend: parseFloat(insights.spend || 0),
              impressions: parseInt(insights.impressions || 0),
              clicks: parseInt(insights.clicks || 0),
              reach: parseInt(insights.reach || 0),
              leads: parseInt(insights.leads || 0),
              cost_per_lead: parseFloat(insights.cost_per_lead || 0),
              frequencia: parseInt(insights.reach) > 0 ? (parseInt(insights.impressions) / parseInt(insights.reach)) : 0
            };
          });

          console.log(`🛡️ [FALLBACK ACTIVATED] Retornando ${adsFormatted.length} anúncios do banco local da organização.`);
          return NextResponse.json({ data: adsFormatted, is_fallback: true });
        }
      }
    } catch (fallbackError) {
      console.error('❌ Falha ao carregar anúncios locais via Fallback no Supabase:', fallbackError.message);
    }

    return NextResponse.json({ data: [] });
  }
}