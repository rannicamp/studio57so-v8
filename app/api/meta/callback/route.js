import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request) {
 const requestUrl = new URL(request.url);
 const code = requestUrl.searchParams.get('code');
 const error = requestUrl.searchParams.get('error');
 const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

 // 1. Logs de Início
 console.log('🔵 [CALLBACK FB] Iniciando...');

 if (error || !code) {
 console.error('🔴 [CALLBACK FB] Erro ou Cancelamento:', error);
 return NextResponse.redirect(`${baseUrl}/configuracoes/integracoes?error=access_denied`);
 }

 try {
 // 2. Cliente Supabase Normal (Para saber quem está logado no navegador)
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) {
 console.error('🔴 [CALLBACK FB] Usuário não identificado (Cookie perdido?).');
 return NextResponse.redirect(`${baseUrl}/login?error=unauthorized`);
 }

 // 3. Busca a Organização do Usuário
 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (!userData?.organizacao_id) {
 console.error('🔴 [CALLBACK FB] Usuário sem organização.');
 return NextResponse.redirect(`${baseUrl}/configuracoes/integracoes?error=no_org`);
 }

 console.log(`🟢 [CALLBACK FB] Org Identificada: ${userData.organizacao_id}`);

 // 🔥 CORREÇÃO: Puxando os nomes exatos das variáveis do seu .env.local do APP 1 (Leads)
 const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
 const fbAppSecret = process.env.FACEBOOK_CLIENT_SECRET;
 const fbApiVersion = process.env.FACEBOOK_API_VERSION || 'v19.0';
 const fbCallbackUrl = process.env.FACEBOOK_CALLBACK_URL || `${baseUrl}/api/meta/callback`;

 // 4. Troca o "CODE" pelo "TOKEN" no Facebook
 const tokenUrl = `https://graph.facebook.com/${fbApiVersion}/oauth/access_token?client_id=${fbAppId}&client_secret=${fbAppSecret}&redirect_uri=${fbCallbackUrl}&code=${code}`;

 const tokenRes = await fetch(tokenUrl);
 const tokenData = await tokenRes.json();

 if (tokenData.error) throw new Error(tokenData.error.message);

 let accessToken = tokenData.access_token;

 // 5. Upgrade para Token de Longa Duração (60 dias)
 const longLivedUrl = `https://graph.facebook.com/${fbApiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${fbAppId}&client_secret=${fbAppSecret}&fb_exchange_token=${accessToken}`;

 const longLivedRes = await fetch(longLivedUrl);
 const longLivedData = await longLivedRes.json();

 if (longLivedData.access_token) accessToken = longLivedData.access_token;

 // 6. COLETAR DADOS DO CLIENTE (Via Fetch Nativo, muito mais blindado contra falhas)
 const profileUrl = `https://graph.facebook.com/${fbApiVersion}/me?fields=name,id&access_token=${accessToken}`;
 const profileRes = await fetch(profileUrl);
 const userProfile = await profileRes.json();

 if (userProfile.error) throw new Error(userProfile.error.message);

 console.log(`🟢 [CALLBACK FB] Dados do Facebook coletados: ${userProfile.name}`);

 // 7. MODO DEUS: Gravar no Banco usando Service Role Key 🛡️
 const supabaseAdmin = createAdminClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 {
 auth: {
 autoRefreshToken: false,
 persistSession: false
 }
 }
 );

 const { error: dbError } = await supabaseAdmin
 .from('integracoes_meta')
 .upsert({
 organizacao_id: userData.organizacao_id,
 access_token: accessToken,
 nome_conta: userProfile.name,
 meta_user_id: userProfile.id, // <-- Corrigido o Mapeamento da coluna certa
 status: 'pendente_pagina',
 updated_at: new Date()
 }, { onConflict: 'organizacao_id' });

 if (dbError) {
 console.error('🚨 [CALLBACK FB] ERRO CRÍTICO NO BANCO:', dbError);
 throw new Error(dbError.message);
 }

 console.log('✅ [CALLBACK FB] Sucesso Absoluto! Dados salvos.');

 // RENDERIZA UM HTML QUE FECHA O POPUP NO NAVEGADOR
 const successHtml = `
 <html>
 <body>
 <script>
 if (window.opener) {
 window.opener.postMessage('fb_oauth_success', '*');
 window.close();
 } else {
 window.location.href = '${baseUrl}/configuracoes/integracoes?step=select_page&success=true';
 }
 </script>
 <p>Fechando janela de autenticação...</p>
 </body>
 </html>
 `;
 return new NextResponse(successHtml, { headers: { 'Content-Type': 'text/html' } });

 } catch (err) {
 console.error('💥 [CALLBACK FB] Exceção:', err);

 const errorHtml = `
 <html>
 <body>
 <script>
 if (window.opener) {
 window.opener.postMessage('fb_oauth_error', '*');
 window.close();
 } else {
 window.location.href = '${baseUrl}/configuracoes/integracoes?error=server_error';
 }
 </script>
 <p>Ocorreu um erro. Fechando janela...</p>
 </body>
 </html>
 `;
 return new NextResponse(errorHtml, { headers: { 'Content-Type': 'text/html' }, status: 500 });
 }
}