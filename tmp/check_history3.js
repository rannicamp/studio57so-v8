const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    SELECT id, data_movimentacao, coluna_anterior_id, coluna_nova_id 
    FROM historico_movimentacao_funil 
    WHERE coluna_anterior_id = coluna_nova_id
    LIMIT 10;
  ` }); // I will just fetch rows normally instead of RPC since execute_sql didn't work.

  const { data: rows, error: err } = await supabase
    .from('historico_movimentacao_funil')
    .select('id, data_movimentacao, coluna_anterior_id, coluna_nova_id')
    .limit(10);
    
  let dups = rows.filter(r => r.coluna_anterior_id === r.coluna_nova_id);
  console.log('Duplicates in DB:', dups.length > 0 ? dups : 'None found in sample. Checking all...');
  
  if (dups.length === 0) {
      const { data: allRows } = await supabase.from('historico_movimentacao_funil').select('id, data_movimentacao, coluna_anterior_id, coluna_nova_id');
      dups = allRows.filter(r => r.coluna_anterior_id === r.coluna_nova_id);
      console.log('Total duplicates:', dups.length);
      console.log(dups.slice(0, 5));
  }
}

checkDuplicates();
