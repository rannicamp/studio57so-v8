require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
  const { data: users } = await supabaseAdmin.from('usuarios').select('id').limit(1);
  const userId = users[0].id;
  
  const { data, error } = await supabaseAdmin.rpc('mark_whatsapp_messages_read_multi', {
    v_contact_id: 1, // some invalid contact is fine
    v_user_id: userId
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

testRpc().catch(console.error);
