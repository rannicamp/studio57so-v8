import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

export async function GET(request) {
 try {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 // Se não tiver usuário, retorna erro, mas se for erro de lógica, retorna vazio
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
 return NextResponse.json({ campaigns: [], adsets: [] }); }

 const api = FacebookAdsApi.init(integracao.access_token);
 const adAccountId = integracao.ad_account_id.startsWith('act_') ? integracao.ad_account_id : `act_${integracao.ad_account_id}`;
 const account = new AdAccount(adAccountId);

 // Busca com limite para ser rápido
 const campaigns = await account.getCampaigns(['name', 'status'], { limit: 500 });
 const adsets = await account.getAdSets(['name', 'status', 'campaign_id'], { limit: 500 });

 return NextResponse.json({
 campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status })),
 adsets: adsets.map(a => ({ id: a.id, name: a.name, campaign_id: a.campaign_id, status: a.status }))
 });

 } catch (error) {
 console.error('Erro campanhas (Ignorado):', error.message);
 // Em caso de erro fatal (ex: token expirado), retorna vazio para não travar a tela
 return NextResponse.json({ campaigns: [], adsets: [] });
 }
}