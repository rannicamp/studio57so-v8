const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targetTemplates = [
  'saudacao_entrada_v3',
  'saudacao_entrada_v2',
  'beta_suites_1',
  'eua_retomar_conversa',
  'oi_tudo_bem_',
  'reativar_contato_em_andamento',
  'reativar_contato_perdido',
  'reativar_contato'
];

async function run() {
  const { data: config } = await supabase
    .from('configuracoes_whatsapp')
    .select('*')
    .eq('organizacao_id', 2)
    .maybeSingle();

  if (!config) return;

  const metaToken = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${metaToken}` }
    });

    if (res.ok) {
      const resJson = await res.json();
      const templates = (resJson.data || []).filter(t => targetTemplates.includes(t.name) && t.status === 'APPROVED');
      
      templates.forEach(t => {
        console.log(`\n=========================================`);
        console.log(`Template: "${t.name}" (${t.language})`);
        console.log(`Componentes:`);
        console.log(JSON.stringify(t.components, null, 2));
      });
    }
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
