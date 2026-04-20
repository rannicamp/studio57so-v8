require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: oData } = await supabase.from('orcamentos').select('*').limit(1);
  console.log('Orcamentos cols:', Object.keys(oData[0] || {}));
  const { data: iData } = await supabase.from('orcamento_itens').select('*').limit(1);
  console.log('Itens cols:', Object.keys(iData[0] || {}));
}
check();
