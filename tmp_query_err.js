require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: msgs, error: e2 } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('contato_id', 5490)
    .order('created_at', { ascending: false })
    .limit(1);
    
  console.log("whatsapp_messages:", JSON.stringify(msgs, null, 2));
}

run().catch(console.error);
