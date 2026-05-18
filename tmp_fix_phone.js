require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('telefones')
    .update({ telefone: '16177972581' })
    .eq('id', 5911)
    .select();
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log("Updated Phone to:", data);
}

run().catch(console.error);
