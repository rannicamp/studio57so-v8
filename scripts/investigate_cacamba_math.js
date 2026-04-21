const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigate() {
  try {
     const { data: pciData } = await supabase
            .from('pedidos_compra_itens')
            .select(`id, pedido_compra_id, tipo_operacao, quantidade_solicitada`)
            .eq('material_id', 10010);
     console.log("Pedidos Compra Itens para Caçamba:");
     console.log(pciData);

     const { data: movData } = await supabase
            .from('movimentacoes_estoque')
            .select('id, pedido_compra_id, tipo, quantidade')
            .eq('material_id', 10010);
     console.log("\nMovimentações de Estoque para Caçamba:");
     console.log(movData);

     const { data: estoqueData } = await supabase
            .from('estoque')
            .select('id, quantidade_atual, quantidade_em_uso')
            .eq('material_id', 10010);
     console.log("\nEstoque Atual para Caçamba:");
     console.log(estoqueData);

  } catch(e) {
     console.error(e);
  }
}

investigate();
