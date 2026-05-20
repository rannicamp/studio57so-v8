require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: messages, error: mErr } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, sender_id, receiver_id, conversation_id, conversation_record_id, content')
    .eq('contato_id', 4931);
    
  console.log(JSON.stringify(messages, null, 2));
}
run();
