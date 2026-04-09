const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
  .from('whatsapp_conversations')
  .select(`
    id,
    contato_id,
    updated_at,
    last_message_id,
    customer_window_start_at,
    user_unread_counts,
    is_archived,
    contatos (
        id,
        nome,
        foto_url,
        tipo_contato
    ),
    last_message: whatsapp_messages!last_message_id (
        content,
        created_at,
        status
    ),
    recent_msgs: whatsapp_messages!whatsapp_messages_conversation_record_id_fkey (
        sent_at,
        direction
    )
  `)
  .order('sent_at', { foreignTable: 'recent_msgs', ascending: false })
  .limit(10, { foreignTable: 'recent_msgs' })
  .order('updated_at', { ascending: false })
  .limit(3);

  console.log(JSON.stringify({ error, data }, null, 2));
}

run();
