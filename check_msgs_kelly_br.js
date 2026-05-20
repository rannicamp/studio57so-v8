require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: msgs, error: mErr } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, sender_id, receiver_id, conversation_record_id, raw_payload')
    .eq('contato_id', 4931)
    .order('created_at', { ascending: true });
    
  // Filter manually
  const brMsgs = msgs.filter(m => (m.sender_id && m.sender_id.includes('88442862')) || (m.receiver_id && m.receiver_id.includes('88442862')));
    
  console.log(JSON.stringify(brMsgs, null, 2));
}
run();
