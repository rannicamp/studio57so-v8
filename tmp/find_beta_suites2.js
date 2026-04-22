require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const empId = 5; // Beta Suítes

  // 1. Anexos Gerais
  const { data: anexos } = await supabase
    .from('anexos')
    .select('*')
    .or(`entidade_id.eq.${empId},url.ilike.%beta%`);
  console.log("Anexos:", anexos);

  // 2. Tarefas / Tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('empreendimento_id', empId);
  console.log("Tickets:", tickets?.length || 0);

  // 3. Pedidos de Compra
  const { data: pedidos } = await supabase
    .from('pedidos_compra')
    .select('*, itens_pedido_compra(*)')
    .eq('empreendimento_id', empId);
  console.log("Pedidos de Compra:", pedidos?.length || 0);

  if (pedidos && pedidos.length > 0) {
     const pedidosIds = pedidos.map(p => p.id);
     const { data: anexosPedidos } = await supabase
       .from('anexos')
       .select('*')
       .eq('entidade_tipo', 'pedido_compra')
       .in('entidade_id', pedidosIds);
     console.log("Anexos dos Pedidos de Compra:", anexosPedidos?.length || 0);
     if (anexosPedidos) console.log("URLs Anexos PC:", anexosPedidos.map(a => a.url));
  }

  // Check Storage Buckets for anything with beta
  const { data: files } = await supabase.storage.from('anexos').list('beta', { limit: 100, search: 'beta' });
  console.log("Storage anexos/beta:", files);
}

run();
