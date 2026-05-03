require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Query using raw postgrest to get first row of empreendimentos
  const { data, error } = await supabase.from('empreendimentos').select('*').limit(1);
  if (error) { console.error('Error fetching empreendimentos', error); return; }
  console.log('Columns in empreendimentos:', Object.keys(data[0] || {}));
  
  // also check produtos
  const { data: pData, error: pError } = await supabase.from('produtos').select('*').limit(1);
  if (pError) { console.error('Error fetching produtos', pError); }
  else { console.log('Columns in produtos:', Object.keys(pData[0] || {})); }
}
check();
