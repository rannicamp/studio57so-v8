require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: convs, error: mErr } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('contato_id', 4931);
    
  console.log(JSON.stringify(convs, null, 2));
}
run();
