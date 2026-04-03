import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Cliente para ler cookie
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Cliente para gravar a força
import { FacebookAdsApi, User } from 'facebook-nodejs-business-sdk';

// GET: Lista as páginas (Mantive igual, pois estava funcionando)
export async function GET(request) {
 try {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (!userData?.organizacao_id) return NextResponse.json({ error: 'Org não encontrada' }, { status: 400 });

 const { data: integracao } = await supabase
 .from('integracoes_meta')
 .select('access_token')
 .eq('organizacao_id', userData.organizacao_id)
 .single();

 if (!integracao?.access_token) {
 return NextResponse.json({ error: 'Token não encontrado.' }, { status: 404 });
 }

 const api = FacebookAdsApi.init(integracao.access_token);
 const me = new User('me');
 const facebookData = await me.get(['name', 'id', 'picture']);
 const accounts = await me.getAccounts(['name', 'access_token', 'id', 'picture', 'tasks']);

 const pages = accounts.map(page => ({
 id: page.id,
 name: page.name,
 picture: page.picture?.data?.url,
 access_token: page.access_token,
 pode_anunciar: page.tasks.includes('ADVERTISE') || page.tasks.includes('Create Ads')
 }));

 return NextResponse.json({ user: { name: facebookData.name, id: facebookData.id },
 pages: pages });

 } catch (error) {
 console.error('Erro ao buscar páginas:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

// POST: Salva a página escolhida (AQUI ESTÁ A CORREÇÃO BLINDADA 🛡️)
export async function POST(request) {
 console.log('🔵 [Meta Pages] Recebendo pedido de salvamento...');
 // 1. Verificação de Segurança (Quem é o usuário?)
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) {
 console.error('🔴 [Meta Pages] Usuário não logado tentou salvar.');
 return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
 }

 try {
 const body = await request.json();
 const { page_id, page_name, page_access_token } = body;

 console.log(`🔵 [Meta Pages] Tentando salvar página: ${page_name} (${page_id})`);

 // 2. Busca a Org do Usuário
 const { data: userData } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (!userData?.organizacao_id) {
 throw new Error('Usuário sem organização vinculada.');
 }

 const orgId = userData.organizacao_id;
 console.log(`🟢 [Meta Pages] Org ID: ${orgId}`);

 // 3. MODO DEUS: Inicializa cliente Admin para garantir a gravação
 const supabaseAdmin = createAdminClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY, {
 auth: {
 autoRefreshToken: false,
 persistSession: false
 }
 }
 );

 // 4. ATUALIZA O BANCO (UPDATE)
 const { error, data } = await supabaseAdmin
 .from('integracoes_meta')
 .update({
 page_id: page_id,
 nome_conta: page_name, // Salvamos o nome da página para exibir depois
 page_access_token: page_access_token, // Token VIP da página
 status: 'ativo', // <--- Mudança de Status
 updated_at: new Date()
 })
 .eq('organizacao_id', orgId)
 .select(); // Retorna o dado salvo para confirmarmos

 if (error) {
 console.error('🚨 [Meta Pages] ERRO AO GRAVAR NO BANCO:', error);
 throw error;
 }

 console.log('✅ [Meta Pages] Sucesso! Banco atualizado:', data);

 return NextResponse.json({ success: true, data });

 } catch (error) {
 console.error('💥 [Meta Pages] Erro fatal:', error);
 return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
 }
}