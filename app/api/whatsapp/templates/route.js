// app/api/whatsapp/templates/route.js

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
 const supabaseUser = await createServerClient();
 const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

 if (authError || !user) {
 return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
 }

 const { data: profile } = await supabaseUser.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 if (!profile || !profile.organizacao_id) return NextResponse.json({ error: 'Perfil / Organização não encontrados' }, { status: 404 });

 const supabaseAdmin = getSupabaseAdmin();

 try {
 // 1. Busca as configurações MUILT-TENANT no banco de dados
 const { data: config, error: configError } = await supabaseAdmin
 .from('configuracoes_whatsapp')
 .select('whatsapp_permanent_token, whatsapp_business_account_id')
 .eq('organizacao_id', profile.organizacao_id)
 .limit(1)
 .single();

 if (configError || !config) {
 console.error('Erro ao buscar credenciais do WhatsApp para org:', profile.organizacao_id);
 return NextResponse.json({ error: 'Credenciais do WhatsApp SaaS não configuradas para sua empresa.' }, { status: 500 });
 }


 // 🏆 HIERARQUIA DE TOKEN: env var permanente > banco de dados (pode estar expirado!)
 const WHATSAPP_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || config.whatsapp_permanent_token;
 const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

 if (process.env.WHATSAPP_SYSTEM_USER_TOKEN) {
 console.log('🏆 [Templates] Usando token permanente do System User.');
 } else {
 console.warn('⚠️ [Templates] Usando token do banco. Configure WHATSAPP_SYSTEM_USER_TOKEN no Netlify para evitar expiração.');
 }

 // Verifica se o ID da conta de negócios está configurado
 if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
 return NextResponse.json({ error: 'ID da Conta de Negócios (WABA ID) não configurado.' }, { status: 500 });
 }

 // 2. Monta a URL para a API da Meta
 const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;

 // 3. Chama a API da Meta
 const apiResponse = await fetch(url, {
 method: 'GET',
 headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
 });

 const responseData = await apiResponse.json();

 if (!apiResponse.ok) {
 console.error('Erro da API do WhatsApp ao buscar templates:', responseData);
 return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
 }

 // 4. Filtra apenas os modelos que estão APROVADOS
 const safeData = Array.isArray(responseData?.data) ? responseData.data : [];
 const approvedTemplates = safeData.filter(template => template.status === 'APPROVED');

 // 5. Retorna a lista de modelos aprovados para o front-end
 return NextResponse.json(approvedTemplates);

 } catch (error) {
 console.error('Falha crítica ao buscar modelos de mensagem:', error);
 return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
 }
}