require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from('feedback').update({ status: 'Concluído' }).in('id', [70, 72]);
  console.log("Tickets 70 e 72 marcados como Concluído!");
}

run();
