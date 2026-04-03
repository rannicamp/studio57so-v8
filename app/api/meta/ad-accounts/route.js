import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { FacebookAdsApi, User } from 'facebook-nodejs-business-sdk';

// GET: Lista as contas e informa qual está selecionada atualmente
export async function GET(request) {
 try {
 const supabase = await createClient();
 // 1. Identifica o usuário e sua organização
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (!userData?.organizacao_id) return NextResponse.json({ error: 'Org não encontrada' }, { status: 400 });

 // 2. Busca o Token da Organização
 const { data: integracao } = await supabase
 .from('integracoes_meta')
 .select('access_token, ad_account_id')
 .eq('organizacao_id', userData.organizacao_id)
 .single();

 if (!integracao?.access_token) {
 return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
 }

 // 3. Conecta no Facebook
 const api = FacebookAdsApi.init(integracao.access_token);
 const me = new User('me');
 // 4. Busca as Contas de Anúncio
 // Trazemos ID, Nome, Moeda e Status
 const accounts = await me.getAdAccounts(['name', 'account_id', 'currency', 'account_status']);

 // 5. Retorna limpo para o Front-end
 const formattedAccounts = accounts.map(acc => ({
 id: `act_${acc.account_id}`, // Padronizamos com 'act_' para facilitar
 name: acc.name,
 currency: acc.currency,
 status: acc.account_status === 1 ? 'Ativa' : 'Inativa', // 1 = Active
 is_selected: `act_${acc.account_id}` === integracao.ad_account_id || `act_${acc.account_id}` === `act_${integracao.ad_account_id}`
 }));

 return NextResponse.json({
 accounts: formattedAccounts,
 selected_account_id: integracao.ad_account_id ? (integracao.ad_account_id.startsWith('act_') ? integracao.ad_account_id : `act_${integracao.ad_account_id}`) : null
 });

 } catch (error) {
 console.error('Erro ao buscar contas:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

// POST: Salva a conta escolhida no banco
export async function POST(request) {
 try {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 const body = await request.json();
 const { ad_account_id } = body; // Esperamos algo como "act_123456"

 if (!ad_account_id) return NextResponse.json({ error: 'ID da conta obrigatório' }, { status: 400 });

 // Busca Org ID
 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 // Usa ADMIN client para garantir a gravação (Update)
 const supabaseAdmin = createAdminClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 { auth: { persistSession: false } }
 );

 const { error } = await supabaseAdmin
 .from('integracoes_meta')
 .update({ ad_account_id: ad_account_id,
 updated_at: new Date()
 })
 .eq('organizacao_id', userData.organizacao_id);

 if (error) throw error;

 return NextResponse.json({ success: true });

 } catch (error) {
 console.error('Erro ao salvar conta:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}