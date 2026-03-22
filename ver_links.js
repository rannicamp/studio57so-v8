require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('sys_notification_templates').select('id, tabela_alvo, evento, link_template');
  console.log('TEMPLATES ATUAIS:');
  console.table(data);
}
run();
