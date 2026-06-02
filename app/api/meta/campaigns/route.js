import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '401' }, { status: 401 });

    const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
    
    // Busca integração
    const { data: integracao } = await supabase
      .from('integracoes_meta')
      .select('access_token, ad_account_id')
      .eq('organizacao_id', userData.organizacao_id)
      .single();

    // BLINDAGEM: Se não tiver token OU não tiver conta de anúncios salva, retorna vazio (200 OK)
    // Isso evita o erro 500 na inicialização
    if (!integracao?.access_token || !integracao?.ad_account_id) {
      return NextResponse.json({ campaigns: [], adsets: [] });
    }

    const api = FacebookAdsApi.init(integracao.access_token);
    const adAccountId = integracao.ad_account_id.startsWith('act_') ? integracao.ad_account_id : `act_${integracao.ad_account_id}`;
    const account = new AdAccount(adAccountId);

    // Busca com limite para ser rápido
    // Alterado de 'campaign_id' para 'campaign' que é o campo oficial de relacionamento da Graph API da Meta
    const campaigns = await account.getCampaigns(['name', 'status'], { limit: 500 });
    const adsets = await account.getAdSets(['name', 'status', 'campaign'], { limit: 500 });

    return NextResponse.json({
      campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status })),
      adsets: adsets.map(a => ({ id: a.id, name: a.name, campaign_id: a.campaign?.id || a.campaign_id, status: a.status }))
    });

  } catch (error) {
    console.error('⚠️ Erro campanhas (Ativando Fallback de Banco):', error.message);
    
    // BLINDAGEM DE RATE LIMIT / OFFLINE: Se falhar a comunicação com a API do Facebook,
    // retornamos as campanhas e adsets históricos que estão salvos no nosso banco de dados.
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (userData?.organizacao_id) {
          const orgId = userData.organizacao_id;
          
          // Busca campanhas locais no banco
          const { data: localCampaigns } = await supabase
            .from('meta_campaigns')
            .select('id, name, status')
            .eq('organizacao_id', orgId);
            
          // Busca adsets locais no banco
          const { data: localAdsets } = await supabase
            .from('meta_adsets')
            .select('id, name, campaign_id, status')
            .eq('organizacao_id', orgId);
            
          if (localCampaigns?.length > 0 || localAdsets?.length > 0) {
            console.log(`🛡️ [FALLBACK ACTIVATED] Retornando ${localCampaigns?.length || 0} campanhas e ${localAdsets?.length || 0} adsets do banco local.`);
            return NextResponse.json({
              campaigns: (localCampaigns || []).map(c => ({ id: c.id, name: c.name, status: c.status })),
              adsets: (localAdsets || []).map(a => ({ id: a.id, name: a.name, campaign_id: a.campaign_id, status: a.status }))
            });
          }
        }
      }
    } catch (fallbackError) {
      console.error('❌ Falha ao carregar campanhas locais via Fallback no Supabase:', fallbackError.message);
    }

    return NextResponse.json({ campaigns: [], adsets: [] });
  }
}