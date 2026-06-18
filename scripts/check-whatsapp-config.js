const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== VERIFICANDO CONFIGURAÇÕES DE WHATSAPP DA ORG 2 ===');
  
  const { data: config, error } = await supabase
    .from('configuracoes_whatsapp')
    .select('*')
    .eq('organizacao_id', 2)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar configurações:', error.message);
    return;
  }

  if (!config) {
    console.log('Nenhuma configuração de WhatsApp encontrada para a Organização 2.');
    return;
  }

  console.log('Configuração encontrada:');
  console.log(` - ID: ${config.id}`);
  console.log(` - Organização ID: ${config.organizacao_id}`);
  console.log(` - Phone Number ID: ${config.whatsapp_phone_number_id}`);
  console.log(` - Business Account ID: ${config.whatsapp_business_account_id}`);
  
  const token = config.whatsapp_permanent_token;
  if (token) {
    console.log(` - Permanent Token: ${token.substring(0, 8)}...${token.substring(token.length - 8)} (Tamanho: ${token.length})`);
  } else {
    console.log(' - Permanent Token: NÃO CONFIGURADO (Usando fallback global do .env se existir)');
  }

  // Tentar bater na API da Meta para listar os templates usando as credenciais da Org 2
  console.log('\n=== TESTANDO COMUNICADOR DE TEMPLATES DA META ===');
  const metaToken = token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  if (!metaToken) {
    console.error('Erro: Nenhum token da Meta disponível para o teste.');
    return;
  }

  if (!config.whatsapp_business_account_id) {
    console.error('Erro: whatsapp_business_account_id não configurado.');
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`;
  console.log(`Consultando URL: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${metaToken}` }
    });

    if (res.ok) {
      const resJson = await res.json();
      const templates = resJson.data || [];
      console.log(`Sucesso! Encontrados ${templates.length} templates no total.`);
      
      const approved = templates.filter(t => t.status === 'APPROVED');
      console.log(` - Templates Aprovados: ${approved.length}`);
      approved.forEach(t => {
        console.log(`   * Template: "${t.name}" (${t.language}) [Categoria: ${t.category}]`);
      });
    } else {
      const errText = await res.text();
      console.error(`Erro na API da Meta (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error('Erro de conexão ao testar templates da Meta:', err.message);
  }
}

run().catch(console.error);
