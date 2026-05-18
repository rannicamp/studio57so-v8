require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: convs, error: e1 } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('contato_id', 5490);
    
  console.log("whatsapp_conversations:", JSON.stringify(convs, null, 2));
}

run().catch(console.error);
