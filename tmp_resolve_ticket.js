require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from('feedback').update({ status: 'Implementado' }).eq('id', 141);
  console.log("Ticket 141 marcado como Implementado!");
}

run().catch(console.error);
