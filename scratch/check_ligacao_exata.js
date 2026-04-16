require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: emp } = await supabase.from('empreendimentos').select('id, nome').ilike('nome', '%Alfa%').single();
  const { data: contratos } = await supabase.from('contratos').select('id, valor_final_venda').eq('empreendimento_id', emp.id).eq('status_contrato', 'Assinado');
  const { data: ligacoes } = await supabase.from('contrato_produtos').select('*');
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, unidade, valor_venda_calculado').eq('empreendimento_id', emp.id);

  let valorContratosTotal = 0;
  let valorEstoqueNaoLigado = 0;

  console.log("--- CONTRATOS DO ALFA --- ");
  for (const c of contratos) {
      valorContratosTotal += Number(c.valor_final_venda);
      const cp = ligacoes.filter(l => l.contrato_id === c.id);
      console.log(`Contrato ${c.id} - Valor: R$ ${c.valor_final_venda} -> Produtos vinculados: ${cp.map(x => x.produto_id).join(',')}`);
  }

  console.log("\n--- PRODUTOS NÃO VINCULADOS A NENHUM CONTRATO --- ");
  for (const p of produtos) {
      const isLigado = ligacoes.some(l => l.produto_id === p.id);
      if (!isLigado) {
          valorEstoqueNaoLigado += Number(p.valor_venda_calculado);
          console.log(`Produto ID ${p.id} (${p.unidade}) - Sem contrato - Tabela: R$ ${p.valor_venda_calculado}`);
      }
  }

  console.log("\n---- RESUMO ----");
  console.log(`Valor VENDAS (Soma de todos os contratos assinados do Alfa): R$ ${valorContratosTotal}`);
  console.log(`Valor ESTOQUE (Soma da tabela de produtos sem NENHUM vínculo): R$ ${valorEstoqueNaoLigado}`);
  console.log(`VGV TOTAL POSSÍVEL: R$ ${(valorContratosTotal + valorEstoqueNaoLigado).toFixed(2)}`);
}

run();
