const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixCaçamba() {
  try {
     const { data, error } = await supabase
        .from('pedidos_compra_itens')
        .update({ tipo_operacao: 'Aluguel' })
        .in('id', [572, 779])
        .select();
        
     if (error) throw error;
     
     console.log("Itens corrigidos para Aluguel:", data);
  } catch(e) {
     console.error(e);
  }
}

fixCaçamba();
