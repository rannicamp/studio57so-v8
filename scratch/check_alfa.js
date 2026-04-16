require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: emp } = await supabase.from('empreendimentos').select('id, nome').ilike('nome', '%Alfa%').single();
  
  if (!emp) {
    console.log("Empreendimento Alfa não encontrado!");
    return;
  }

  const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, status, area_m2, valor_venda_calculado, preco_m2').eq('empreendimento_id', emp.id);
  const { data: contratos } = await supabase.from('contratos').select('id, produto_id, valor_final_venda, status_contrato').eq('empreendimento_id', emp.id).eq('status_contrato', 'Assinado');

  let valorEstoqueListado = 0;
  let valorVendido = 0;

  console.log(`\n=== 🏢 Análise: ${emp.nome} ===`);
  console.log(`Total de Unidades cadastradas (Físico): ${produtos.length}`);
  console.log(`Total de Contratos Assinados na plataforma: ${contratos.length}\n`);

  console.log("--- 📝 PRODUTOS EM ESTOQUE/RESERVADOS (Sem contrato assinado) ---");
  for (const p of produtos) {
      const contratoId = contratos.find(c => c.produto_id === p.id);
      if (!contratoId) {
          const v = Number(p.valor_venda_calculado) || 0;
          valorEstoqueListado += v;
          console.log(`  [${p.status}] Um: ${p.unidade} | Tipo: ${p.tipo} | VGV Tabela: R$ ${v.toFixed(2)} (R$ ${Number(p.preco_m2).toFixed(2)}/m2 * ${p.area_m2}m2)`);
      }
  }

  console.log("\n--- 🤝 CONTRATOS ASSINADOS ---");
  for (const c of contratos) {
      const v = Number(c.valor_final_venda) || 0;
      valorVendido += v;
      const pId = produtos.find(p => p.id === c.produto_id);
      console.log(`  [VENDIDO] Um: ${pId?.unidade} | VGV Fechado (Contrato): R$ ${v.toFixed(2)}`);
  }

  console.log(`\n===========================================`);
  console.log(`Subtotal em Tabela (Estoque e Reservados): R$ ${valorEstoqueListado.toFixed(2)}`);
  console.log(`Subtotal Vendido Oficial (Contratos): R$ ${valorVendido.toFixed(2)}`);
  
  const vgvTotal = valorEstoqueListado + valorVendido;
  console.log(`\n💰 VGV Total Calculado pelo Dashboard: R$ ${vgvTotal.toFixed(2)}\n`);
}

run();
