const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data: allRows } = await supabase.from('historico_movimentacao_funil').select('id, data_movimentacao, contato_no_funil_id, coluna_anterior_id, coluna_nova_id').order('data_movimentacao', { ascending: false });
  
  const dups = [];
  for(let i=0; i<allRows.length - 1; i++) {
      if(allRows[i].contato_no_funil_id === allRows[i+1].contato_no_funil_id &&
         allRows[i].coluna_anterior_id === allRows[i+1].coluna_anterior_id &&
         allRows[i].coluna_nova_id === allRows[i+1].coluna_nova_id) {
          dups.push(allRows[i]);
      }
  }
  console.log('Adjacent semantic duplicates:', dups.length);
  if(dups.length > 0) console.log(dups.slice(0, 5));
}

checkDuplicates();
