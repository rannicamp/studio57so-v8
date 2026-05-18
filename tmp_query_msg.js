require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
