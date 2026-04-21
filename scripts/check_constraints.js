const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkConstraints() {
  try {
     // I will try to insert a fake record with 'Entrada por Aluguel' to see if it fails on constraint.
     // Actually, it's better to fetch the constraints from information_schema, but REST API doesn't allow that directly.
     // I'll try to insert and catch the specific error
     const { data, error } = await supabase.from('movimentacoes_estoque').insert({
         estoque_id: 150,
         tipo: 'Entrada por Aluguel',
         quantidade: 0.1,
         organizacao_id: 2
     });
     
     if (error) console.log("ERROR:", error.message);
     else console.log("SUCCESS, constraint allows it.");
     
     if (!error) {
       await supabase.from('movimentacoes_estoque').delete().eq('quantidade', 0.1);
     }
  } catch(e) {
     console.error(e);
  }
}

checkConstraints();
