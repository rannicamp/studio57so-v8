require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.from('feedback').update({ status: 'Concluído' }).eq('id', 69);
  if (error) console.error(error);
  else console.log('Ticket 69 fechado!');
}
run();
