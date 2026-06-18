const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: config } = await supabase
    .from('configuracoes_whatsapp')
    .select('*')
    .eq('organizacao_id', 2)
    .maybeSingle();

  if (!config) {
    console.log('Nenhuma configuração de WhatsApp encontrada.');
    return;
  }

  const metaToken = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${metaToken}` }
    });

    if (res.ok) {
      const resJson = await res.json();
      const approved = (resJson.data || []).filter(t => t.status === 'APPROVED');
      
      approved.forEach(t => {
        console.log(`\n=========================================`);
        console.log(`Template: "${t.name}" (${t.language})`);
        console.log(`Categoria: ${t.category}`);
        console.log(`Componentes:`);
        console.log(JSON.stringify(t.components, null, 2));
      });
    } else {
      console.error('Erro na API:', await res.text());
    }
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
