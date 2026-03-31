const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data: allRows } = await supabase.from('historico_movimentacao_funil')
    .select('id, data_movimentacao, contato_no_funil_id, coluna_anterior_id, coluna_nova_id')
    .order('data_movimentacao', { ascending: false });
  
  // Group by contato_no_funil_id
  const grouped = {};
  for(let r of allRows) {
      if(!grouped[r.contato_no_funil_id]) grouped[r.contato_no_funil_id] = [];
      grouped[r.contato_no_funil_id].push(r);
  }
  
  const dups = [];
  for(let cardId in grouped) {
      const history = grouped[cardId]; // already sorted desc
      for(let i=0; i<history.length - 1; i++) {
          if(history[i].coluna_anterior_id === history[i+1].coluna_anterior_id &&
             history[i].coluna_nova_id === history[i+1].coluna_nova_id) {
              const d1 = new Date(history[i].data_movimentacao);
              const d2 = new Date(history[i+1].data_movimentacao);
              const diffMs = Math.abs(d1 - d2);
              dups.push({
                  cardId,
                  diffMs,
                  d1: history[i].data_movimentacao,
                  d2: history[i+1].data_movimentacao,
                  ant: history[i].coluna_anterior_id,
                  nov: history[i].coluna_nova_id
              });
          }
      }
  }
  
  console.log('Total semantic duplicates:', dups.length);
  const sameMs = dups.filter(d => d.diffMs < 1000);
  console.log('Within 1 second:', sameMs.length);
  if(sameMs.length > 0) console.log(sameMs.slice(0, 5));
}

checkDuplicates();
