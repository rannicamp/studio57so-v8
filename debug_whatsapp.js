const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Ultimas Mensagens ---');
  const { data: msgs, error: err1 } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_record_id, contato_id, sent_at, created_at, content')
    .order('sent_at', { ascending: false })
    .limit(5);
  console.log(msgs, err1);

  console.log('\n--- Ultimas Conversas ---');
  const { data: convs, error: err2 } = await supabase
    .from('whatsapp_conversations')
    .select('id, contato_id, updated_at, last_message_id')
    .order('updated_at', { ascending: false })
    .limit(5);
  console.log(convs, err2);
}

run();
