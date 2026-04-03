import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request) {
 try {
 console.log('🟢 [WABA OAuth] Iniciando troca de Token Embedded Signup...');
 const body = await request.json();
 const { accessToken: shortLivedToken, isTestMode } = body;
 if (!shortLivedToken) {
 return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 });
 }

 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (!userData?.organizacao_id) {
 return NextResponse.json({ error: 'Org não encontrada' }, { status: 400 });
 }

 const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
 const appSecret = process.env.FACEBOOK_CLIENT_SECRET; let longLivedToken = shortLivedToken;

 // 1. Troca o Token Curto por um Longo (60 dias)
 if (appSecret) {
 console.log('🔄 Trocando Token Curto por Long-Lived Token...');
 const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
 const exchangeRes = await fetch(exchangeUrl);
 const exchangeData = await exchangeRes.json();
 if (exchangeData.access_token) {
 longLivedToken = exchangeData.access_token;
 console.log('✅ Token Long-Lived Recebido com Sucesso!');
 } else {
 console.warn('⚠️ Falha ao obter Token Long-Lived. Usando o original temporário.', exchangeData);
 }
 } else {
 console.warn('⚠️ FACEBOOK_CLIENT_SECRET não configurado. Pulando a turbinação do token, usando temporário.');
 }

 const supabaseAdmin = createAdminClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 { auth: { autoRefreshToken: false, persistSession: false } }
 );

 // 2. Descobrindo a WABA criada no Embedded Signup (Via Graph API)
 // No fluxo Embedded Signup oficial, o Cliente logou com o User dele.
 console.log('🔍 Inspecionando ecossistema de Negócios (Business Managers)...');
 const bmUrl = `https://graph.facebook.com/v22.0/me/businesses?access_token=${longLivedToken}&fields=id,name`;
 const bmRes = await fetch(bmUrl);
 const bmData = await bmRes.json();

 let wabaEncontrada = null;
 let phoneEncontrado = null;

 if (bmData.data && bmData.data.length > 0) {
 for (const bm of bmData.data) {
 const wabaUrl = `https://graph.facebook.com/v22.0/${bm.id}/owned_whatsapp_business_accounts?access_token=${longLivedToken}&fields=id,name`;
 const wabaRes = await fetch(wabaUrl);
 const wabaData = await wabaRes.json();

 if (wabaData.data && wabaData.data.length > 0) {
 wabaEncontrada = wabaData.data[0]; // Pega a primeira WABA

 const phoneUrl = `https://graph.facebook.com/v22.0/${wabaEncontrada.id}/phone_numbers?access_token=${longLivedToken}&fields=id,display_phone_number,verified_name`;
 const phoneRes = await fetch(phoneUrl);
 const phoneData = await phoneRes.json();
 if (phoneData.data && phoneData.data.length > 0) {
 phoneEncontrado = phoneData.data[0]; // Pega o primeiro Telefone
 break;
 }
 }
 }
 }

 if (!wabaEncontrada || !phoneEncontrado) {
 return NextResponse.json({ error: 'Sua conta Facebook foi vinculada, mas não encontramos o seu Número Oficial de WhatsApp. Certifique-se de ter concluído o processo no pop-up.',
 debug_info: bmData
 }, { status: 404 });
 }

 console.log(`✅ MATCH PERFEITO! WABA ID: ${wabaEncontrada.id} | Phone ID: ${phoneEncontrado.id} (${phoneEncontrado.display_phone_number})`);

 // 3. Salvar na Tabela `integracoes_meta`
 const payloadMeta = {
 organizacao_id: userData.organizacao_id,
 access_token: longLivedToken, // O token do cliente (vence em 60 dias)
 whatsapp_business_account_id: wabaEncontrada.id,
 status: 'ativo',
 updated_at: new Date().toISOString()
 };

 const { data: configMetaAtual } = await supabaseAdmin
 .from('integracoes_meta')
 .select('id')
 .eq('organizacao_id', userData.organizacao_id)
 .single();

 if (configMetaAtual?.id) {
 await supabaseAdmin.from('integracoes_meta').update(payloadMeta).eq('id', configMetaAtual.id);
 } else {
 await supabaseAdmin.from('integracoes_meta').insert([payloadMeta]);
 }

 // 4. Salvar na Tabela `configuracoes_whatsapp`
 // IMPORTANTE: Jamais fazer fallback para processo.env.WHATSAPP_SYSTEM_USER_TOKEN no banco!
 // A arquitetura SaaS exige que cada DB Row possua EXCLUSIVAMENTE o token daquele cliente.
 const bestToken = longLivedToken;

 const { data: empresaPadrao } = await supabaseAdmin
 .from('cadastro_empresa')
 .select('id')
 .eq('organizacao_id', userData.organizacao_id)
 .limit(1)
 .single();

 const payloadWhatsApp = {
 organizacao_id: userData.organizacao_id,
 empresa_id: empresaPadrao?.id || 1, // Fallback caso org não tenha empresa
 whatsapp_business_account_id: wabaEncontrada.id,
 whatsapp_phone_number_id: phoneEncontrado.id,
 whatsapp_permanent_token: bestToken, verify_token: process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || 'Srbr19010720@'
 };

 const { data: configWaAtual } = await supabaseAdmin
 .from('configuracoes_whatsapp')
 .select('id')
 .eq('organizacao_id', userData.organizacao_id)
 .single();

 if (configWaAtual?.id) {
 await supabaseAdmin.from('configuracoes_whatsapp').update(payloadWhatsApp).eq('id', configWaAtual.id);
 } else {
 await supabaseAdmin.from('configuracoes_whatsapp').insert([payloadWhatsApp]);
 }

 console.log('🚀 Integração WABA SaaS Concluída e Chumbada no Banco de Dados!');

 return NextResponse.json({
 success: true,
 waba: wabaEncontrada,
 phone: phoneEncontrado,
 message: "Configuração gravada para roteamento SaaS Multitenant."
 });

 } catch (error) {
 console.error('💥 [WABA OAuth] Erro Crítico:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
