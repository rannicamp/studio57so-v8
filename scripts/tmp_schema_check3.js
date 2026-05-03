require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', {query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"});
  if (error) {
    // fallback if exec_sql doesn't exist
    console.error('exec_sql failed, fetching directly', error.message);
  } else {
    const tables = data.map(d => d.table_name).filter(n => n.includes('unidade') || n.includes('venda') || n.includes('tabela') || n.includes('produto') || n.includes('empreendimento'));
    console.log('Relevant tables:', tables);
  }
}
check();
