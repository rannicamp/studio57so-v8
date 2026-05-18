require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('customer_window_start_at')
    .limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}

testQuery().catch(console.error);
