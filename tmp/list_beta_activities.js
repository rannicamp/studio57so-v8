require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const empId = 5; // Beta Suítes
  console.log("=== BUSCANDO ATIVIDADES BETA SUÍTES (ID 5) ===\n");

  // 1. Feedbacks / Tickets
  const { data: feedbacks } = await supabase.from('feedback').select('id, tipo, titulo, status, created_at, descricao').eq('empreendimento_id', empId);
  if (feedbacks && feedbacks.length > 0) {
    console.log(">> FEEDBACKS / TICKETS:");
    feedbacks.forEach(f => console.log(`- [${f.status}] ${f.tipo}: ${f.titulo} (${new Date(f.created_at).toLocaleDateString()})`));
  } else {
    console.log(">> FEEDBACKS / TICKETS: Nenhum encontrado.");
  }

  console.log("\n");

  // 2. Ocorrências
  const { data: ocorrencias } = await supabase.from('ocorrencias').select('id, tipo, titulo, status, created_at').eq('empreendimento_id', empId);
  if (ocorrencias && ocorrencias.length > 0) {
    console.log(">> OCORRÊNCIAS:");
    ocorrencias.forEach(o => console.log(`- [${o.status}] ${o.tipo}: ${o.titulo} (${new Date(o.created_at).toLocaleDateString()})`));
  } else {
    console.log(">> OCORRÊNCIAS: Nenhuma encontrada.");
  }

  console.log("\n");

  // 3. Diários de Obra
  const { data: diarios } = await supabase.from('diarios_obra').select('id, data, clima, status').eq('empreendimento_id', empId);
  if (diarios && diarios.length > 0) {
    console.log(">> DIÁRIOS DE OBRA:");
    diarios.forEach(d => console.log(`- [${d.status}] Data: ${d.data} | Clima: ${d.clima}`));
  } else {
    console.log(">> DIÁRIOS DE OBRA: Nenhum encontrado.");
  }

  console.log("\n");

  // 4. Pedidos de Compra (Atividades de Suprimentos)
  const { data: pedidos } = await supabase.from('pedidos_compra').select('id, titulo, status, data_solicitacao').eq('empreendimento_id', empId).order('data_solicitacao', { ascending: false });
  if (pedidos && pedidos.length > 0) {
    console.log(">> PEDIDOS DE COMPRA (SUPRIMENTOS/SERVIÇOS):");
    pedidos.forEach(p => console.log(`- [${p.status}] ${p.titulo} (${new Date(p.data_solicitacao).toLocaleDateString()})`));
  } else {
    console.log(">> PEDIDOS DE COMPRA: Nenhum encontrado.");
  }
}

run();
