require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: emp } = await supabase.from('empreendimentos').select('id, nome').ilike('nome', '%Beta%').single();
  
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, status, valor_venda_calculado').eq('empreendimento_id', emp.id);
  const { data: contratos } = await supabase.from('contratos').select('id, valor_final_venda, status_contrato').eq('empreendimento_id', emp.id).eq('status_contrato', 'Assinado');

  let disponivelVGV = 0;
  let reservadoVGV = 0;
  let vendidoDbVGV = 0; // na tabela produtos
  let outroStatusVGV = 0;
  let totalBrutoTabelaProdutos = 0;

  for (const p of produtos) {
      const v = Number(p.valor_venda_calculado) || 0;
      totalBrutoTabelaProdutos += v;
      if (p.status === 'Disponível') disponivelVGV += v;
      else if (p.status === 'Reservado') reservadoVGV += v;
      else if (p.status === 'Vendido') vendidoDbVGV += v;
      else outroStatusVGV += v;
  }

  let contratosAssinadosVGV = 0;
  for (const c of contratos) {
      const v = Number(c.valor_final_venda) || 0;
      contratosAssinadosVGV += v;
  }

  console.log(`VGV Bruto (soma de TUDO na tabela produtos): R$ ${totalBrutoTabelaProdutos.toFixed(2)}`);
  console.log(`--- Quebra por status na tabela produtos ---`);
  console.log(`Disponível: R$ ${disponivelVGV.toFixed(2)}`);
  console.log(`Reservado: R$ ${reservadoVGV.toFixed(2)}`);
  console.log(`Vendido: R$ ${vendidoDbVGV.toFixed(2)}`);
  console.log(`Outros: R$ ${outroStatusVGV.toFixed(2)}`);
  console.log(`-------------------------------------------`);
  console.log(`Total em Contratos Assinados: R$ ${contratosAssinadosVGV.toFixed(2)}`);
  
  let vgvDaMinhaTela = disponivelVGV + contratosAssinadosVGV;
  console.log(`\nVGV no meu Dashboard (Disponível + Contratos): R$ ${vgvDaMinhaTela.toFixed(2)}`);
}

run();
