require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: mensagens, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('status', 'failed')
    .order('sent_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Erro fetching messages:', error);
    return;
  }

  console.log(JSON.stringify(mensagens, null, 2));
}

run().catch(console.error);
