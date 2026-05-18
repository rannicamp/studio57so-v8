require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: crmRecords, error: e1 } = await supabase
    .from('crm_conversation_records')
    .select('*')
    .eq('contato_id', 5490);
    
  console.log("crm_conversation_records:", JSON.stringify(crmRecords, null, 2));

  const { data: msgs, error: e2 } = await supabase
    .from('whatsapp_messages')
    .select('id, receiver_id, sender_id, status, error_message, created_at')
    .eq('contato_id', 5490)
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log("whatsapp_messages:", JSON.stringify(msgs, null, 2));

  const { data: phones, error: e3 } = await supabase
    .from('telefones')
    .select('*')
    .eq('contato_id', 5490);
    
  console.log("telefones:", JSON.stringify(phones, null, 2));
}

run().catch(console.error);
