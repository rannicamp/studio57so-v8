require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkReceipts() {
  const { data } = await supabaseAdmin.from('whatsapp_messages').select('id, read_receipts, direction').eq('contato_id', 1).eq('direction', 'inbound');
  console.log(data);
}

checkReceipts().catch(console.error);
