require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('whatsapp_messages')
    .select('id, direction, read_receipts')
    .eq('contato_id', 5490)
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(JSON.stringify(data, null, 2));
}
check();
