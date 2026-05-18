require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
  const { data, error } = await supabaseAdmin.rpc('mark_whatsapp_messages_read_multi', {
    v_contact_id: 1,
    v_user_id: '1'
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

testRpc().catch(console.error);
