require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('contatos_no_funil_produtos').select('*').limit(1);
  console.log('Columns in contatos_no_funil_produtos:', Object.keys(data?.[0] || {}));
  
  // Try querying from the referenced table dynamically or check 'produto_id' relation
  // Alternatively, just query 'empreendimentos' again.
}
check();
