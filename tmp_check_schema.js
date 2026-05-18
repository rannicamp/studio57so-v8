require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_conversations' AND column_name = 'customer_window_start_at';"
  });
  console.log("Schema:", data);
}

checkSchema().catch(console.error);
