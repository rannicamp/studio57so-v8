require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // 1. Empreendimentos
  const { data: emp, error: empErr } = await supabase
    .from('empreendimentos')
    .select('*')
    .ilike('nome', '%beta%');
  
  if (empErr) console.error("Error emp", empErr);
  console.log("Empreendimentos:", emp);

  const empId = emp?.[0]?.id;
  if (!empId) return;

  // 2. Anexos
  const { data: anexos, error: anexosErr } = await supabase
    .from('anexos')
    .select('*')
    .eq('entidade_tipo', 'empreendimento')
    .eq('entidade_id', empId);
  console.log("Anexos do empreendimento:", anexos);

  // 3. Tarefas
  const { data: tarefas, error: tarefasErr } = await supabase
    .from('tickets_engenharia') // or just tickets or feedbacks
    .select('*')
    .eq('empreendimento_id', empId);
  console.log("Tarefas:", tarefas?.length || 0);

  // 4. Pedidos Compra
  const { data: pedidos, error: pedidosErr } = await supabase
    .from('pedidos_compra')
    .select('*')
    .eq('empreendimento_id', empId);
  console.log("Pedidos de Compra:", pedidos?.length || 0);

}

run();
