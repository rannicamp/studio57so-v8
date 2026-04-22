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

  // 1. Empreendimento
  const { data: emp } = await supabase.from('empreendimentos').select('*').eq('id', empId);
  results.empreendimento = emp;

  // 2. Empreendimento Anexos
  const { data: emp_anexos } = await supabase.from('empreendimento_anexos').select('*').eq('empreendimento_id', empId);
  results.empreendimento_anexos = emp_anexos;

  // 3. Pedidos de Compra
  const { data: pedidos } = await supabase.from('pedidos_compra').select('*').eq('empreendimento_id', empId);
  results.pedidos = pedidos;

  if (pedidos && pedidos.length > 0) {
    const pIds = pedidos.map(p => p.id);
    
    // Anexos dos pedidos
    const { data: anexos_pc } = await supabase.from('pedidos_compra_anexos').select('*').in('pedido_id', pIds);
    results.pedidos_compra_anexos = anexos_pc;
    
    // Itens
    const { data: itens } = await supabase.from('pedidos_compra_itens').select('*').in('pedido_id', pIds);
    results.pedidos_compra_itens = itens;
  }

  // 4. Atividades / Feedbacks
  const { data: feedbacks } = await supabase.from('feedback').select('*').eq('empreendimento_id', empId);
  results.feedbacks = feedbacks;

  fs.writeFileSync('c:\\Projetos\\studio57so-v8\\tmp\\beta_suites_full.json', JSON.stringify(results, null, 2));
  console.log("Data dumped to tmp/beta_suites_full.json");
}

run();
