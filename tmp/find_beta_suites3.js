require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const empId = 5; // Beta Suítes
  let results = {};

  // Pedidos Compra
  const { data: pedidos } = await supabase
    .from('pedidos_compra')
    .select('*')
    .eq('empreendimento_id', empId);
  results.pedidos = pedidos;

  if (pedidos && pedidos.length > 0) {
    const pIds = pedidos.map(p => p.id);
    
    // Anexos dos pedidos
    const { data: anexos_pc } = await supabase
       .from('anexos')
       .select('*')
       .eq('entidade_tipo', 'pedido_compra')
       .in('entidade_id', pIds);
    results.anexos_pc = anexos_pc;
  }

  // Itens Pedido Compra (checking if there are any)
  if (pedidos && pedidos.length > 0) {
    const { data: itens } = await supabase
      .from('itens_pedido_compra')
      .select('*')
      .in('pedido_id', pedidos.map(p => p.id));
    results.itens_pc = itens;
  }

  // Anexos globais que tenham beta no nome
  const { data: anexos_beta } = await supabase
    .from('anexos')
    .select('*')
    .ilike('nome_arquivo', '%beta%');
  results.anexos_beta = anexos_beta;

  fs.writeFileSync('c:\\Projetos\\studio57so-v8\\tmp\\beta_suites_data.json', JSON.stringify(results, null, 2));
  console.log("Data dumped to tmp/beta_suites_data.json");
}

run();
