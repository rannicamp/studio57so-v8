require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIndexes() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    query: "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename = 'whatsapp_messages';"
  });
  console.log("Indexes:", data);
  if (error) console.log("Error:", error);
}

checkIndexes().catch(console.error);
