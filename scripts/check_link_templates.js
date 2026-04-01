require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: templates, error } = await supabase
    .from('sys_notification_templates')
    .select('id, tabela_alvo, evento, titulo_template, link_template')
    .ilike('link_template', '%caixa-de-entrada%');

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Templates com caixa-de-entrada:', templates);
  
  const { data: templates2, error2 } = await supabase
    .from('sys_notification_templates')
    .select('id, tabela_alvo, evento, titulo_template, link_template')
    .eq('tabela_alvo', 'whatsapp_messages');
    
  console.log('Templates para whatsapp_messages:', templates2);
  
}

run().catch(console.error);
