// scratch_debug_token_details.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: integracao, error } = await supabase
    .from('integracoes_meta')
    .select('*')
    .eq('organizacao_id', 2)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Erro ao buscar integracoes_meta:', error.message);
    return;
  }

  console.log('--- DADOS DA TABELA integracoes_meta (Org 2) ---');
  console.log('ID:', integracao.id);
  console.log('Nome da Conta:', integracao.nome_conta);
  console.log('Instagram Account ID:', integracao.instagram_business_account_id);
  console.log('Page ID:', integracao.page_id);
  
  // O token do user (FB login)
  const userToken = integracao.access_token;
  console.log('User Access Token (access_token) começa com:', userToken ? userToken.slice(0, 15) : 'nulo');

  // O token da pagina (usado para DMs)
  const pageToken = integracao.page_access_token;
  console.log('Page Access Token (page_access_token) começa com:', pageToken ? pageToken.slice(0, 15) : 'nulo');

  console.log('\n--- DADOS DO ARQUIVO .env.local ---');
  console.log('META_PAGE_ACCESS_TOKEN começa com:', process.env.META_PAGE_ACCESS_TOKEN ? process.env.META_PAGE_ACCESS_TOKEN.slice(0, 15) : 'nulo');
  console.log('INSTAGRAM_PAGE_ACCESS_TOKEN começa com:', process.env.INSTAGRAM_PAGE_ACCESS_TOKEN ? process.env.INSTAGRAM_PAGE_ACCESS_TOKEN.slice(0, 15) : 'nulo');
}

run();
