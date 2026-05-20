require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Find messages
  const { data: messages, error: mErr } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, status, content, error_message, created_at, sender_id, receiver_id, raw_payload')
    .eq('contato_id', 4931)
    .order('created_at', { ascending: true })
    .limit(20);
    
  if (mErr) console.error(mErr);
  else console.log("\nMessages:\n", JSON.stringify(messages, null, 2));
}

run();
