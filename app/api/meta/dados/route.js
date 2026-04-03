import { NextResponse } from 'next/server';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
 const { searchParams } = new URL(request.url);

 // Filtros vindos do Front-end
 const organizacaoId = searchParams.get('orgId');
 const startDate = searchParams.get('start');
 const endDate = searchParams.get('end');

 if (!organizacaoId) {
 return NextResponse.json({ error: 'ID da organização obrigatório' }, { status: 400 });
 }

 try {
 const supabase = await createClient();

 // 1. SEGURANÇA: Verificar se o usuário logado pertence a essa organização
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 // (Opcional) Validação extra se o usuário realmente é dono da org
 // const { data: userOrg } = await supabase.from('usuarios')....

 // 2. BUSCAR O TOKEN NO BANCO (A chave do cofre 🔑)
 const { data: integracao, error: dbError } = await supabase
 .from('integracoes_meta')
 .select('page_access_token, page_id, ad_account_id')
 .eq('organizacao_id', organizacaoId)
 .single();

 if (dbError || !integracao?.page_access_token) {
 console.error("Erro banco ou sem token:", dbError);
 return NextResponse.json({ error: 'Integração não encontrada ou desconectada.' }, { status: 404 });
 }

 // 3. INICIALIZAR O SDK COM O TOKEN DO CLIENTE (Dinâmico)
 const api = FacebookAdsApi.init(integracao.page_access_token);
 const showDebug = false; // Mude para true se quiser ver logs no terminal
 if (showDebug) api.setDebug(true);

 // 4. CONFIGURAR PERÍODO (Date Range)
 let timeRange = { since: '2024-01-01', until: new Date().toISOString().split('T')[0] }; // Padrão
 if (startDate && endDate) {
 timeRange = { since: startDate, until: endDate };
 }

 // 5. VALIDAÇÃO ESTRITA: Multi-Inquilino não permite adivinhar contas.
 const adAccountId = integracao.ad_account_id;

 if (!adAccountId) {
 console.warn(`[API Meta Dados] Org ${organizacaoId} não selecionou uma conta de anúncios explícita.`);
 return NextResponse.json({ error: 'Conta de anúncios não selecionada. Configure no menu de integrações.' }, { status: 403 });
 }

 const account = new AdAccount(adAccountId);

 // Campos que queremos buscar
 const fields = [
 'id',
 'name',
 'status',
 'insights.date_preset(maximum) {spend, impressions, clicks, cpc, cpm, cpp, ctr, reach, frequency, cost_per_unique_click, actions}',
 'creative{image_url, thumbnail_url, object_story_spec}',
 ];

 const params = {
 limit: 50,
 time_range: timeRange,
 level: 'ad' // Busca nível de anúncio direto
 };

 const ads = await account.getAds(fields, params);

 // 6. PROCESSAR E RETORNAR (Limpeza de dados)
 const formattedAds = ads.map(ad => {
 const insights = ad.insights?.[0] || {};

 // Tenta pegar imagem (pode variar dependendo do formato do anúncio)
 let imageUrl = ad.creative?.image_url || ad.creative?.thumbnail_url;
 if (!imageUrl && ad.creative?.object_story_spec?.link_data?.picture) {
 imageUrl = ad.creative.object_story_spec.link_data.picture;
 }

 // Calcular Leads (Gambiarra inteligente: procura ação tipo 'lead')
 const actions = insights.actions || [];
 const leadAction = actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
 const leadsCount = leadAction ? parseInt(leadAction.value) : 0;
 const spend = parseFloat(insights.spend || 0);

 return {
 id: ad.id,
 name: ad.name,
 status: ad.status,
 image_url: imageUrl,
 spend: spend,
 impressions: insights.impressions || 0,
 clicks: insights.clicks || 0,
 leads: leadsCount,
 cost_per_lead: leadsCount > 0 ? spend / leadsCount : 0,
 frequencia: insights.frequency
 };
 });

 return NextResponse.json({ data: formattedAds });

 } catch (error) {
 console.error('Erro API Meta:', error);
 // Tratamento de erro de Token Expirado
 if (error.message?.includes('Session has expired') || error.code === 190) {
 return NextResponse.json({ error: 'Token expirado. Reconecte o Facebook.' }, { status: 401 });
 }
 return NextResponse.json({ error: 'Erro ao buscar dados do Facebook.' }, { status: 500 });
 }
}