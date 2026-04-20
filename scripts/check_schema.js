const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const q = `
  SELECT 
    m.nome,
    estq.total_qtd,
    COALESCE((
      SELECT preco_unitario_real 
      FROM public.pedidos_compra_itens pci 
      WHERE pci.material_id = m.id AND preco_unitario_real IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 1
    ), m.preco_unitario, 0) as preco_recente
  FROM (
    SELECT 
      material_id,
      SUM(quantidade_atual + COALESCE(quantidade_em_uso, 0)) as total_qtd
    FROM public.estoque
    WHERE organizacao_id = 2
    GROUP BY material_id
  ) estq
  JOIN public.materiais m ON m.id = estq.material_id
  LIMIT 5;
  `;
  const { data } = await supabase.rpc('exec_sql', { query: q });
  console.log('Test logic:', data);
}
run();
