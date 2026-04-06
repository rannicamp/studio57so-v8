require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getNewTickets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
getNewTickets();
