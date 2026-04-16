require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: emp } = await supabase.from('empreendimentos').select('id, nome').ilike('nome', '%Alfa%').single();
  
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, status, area_m2, valor_venda_calculado, preco_m2').eq('empreendimento_id', emp.id);
  const { data: contratos } = await supabase.from('contratos').select('id, produto_id, valor_final_venda, status_contrato').eq('empreendimento_id', emp.id).eq('status_contrato', 'Assinado');

  console.log(`\n=== 🏢 UNIDADES DISPONÍVEIS - ${emp.nome} ===`);
  const disponiveis = produtos.filter(p => !contratos.some(c => c.produto_id === p.id));
  
  let somaDisponiveis = 0;
  disponiveis.forEach(p => {
    const v = Number(p.valor_venda_calculado) || 0;
    somaDisponiveis += v;
    console.log(`- Unidade: ${p.unidade} | Tipo: ${p.tipo} | Área: ${p.area_m2}m² | Preço Tela: R$ ${v.toFixed(2)}`);
  });

  console.log(`\n💸 SOMA DAS DISPONÍVEIS: R$ ${somaDisponiveis.toFixed(2)}`);

  console.log(`\n=== 🔍 DIAGNÓSTICO DO VGV ===`);
  const somaTabelaBruta = produtos.reduce((acc, p) => acc + (Number(p.valor_venda_calculado) || 0), 0);
  console.log(`1. VGV Bruto da Tabela de Vendas (o que o rodapé mostra): R$ ${somaTabelaBruta.toFixed(2)}`);

  console.log(`\n💡 Por que o Dashboard bate 10 Milhões? Veja as unidades vendidas:`);
  let valorAcrescido = 0;
  for (const c of contratos) {
      const p = produtos.find(prod => prod.id === c.produto_id);
      if (p) {
          const valorTabela = Number(p.valor_venda_calculado) || 0;
          const valorReal = Number(c.valor_final_venda) || 0;
          if (valorReal > valorTabela) {
              valorAcrescido += (valorReal - valorTabela);
              console.log(`- ${p.unidade || 'Unidade'}: Tabela = R$ ${valorTabela.toFixed(2)} | Contrato Real = R$ ${valorReal.toFixed(2)} (+ R$ ${(valorReal - valorTabela).toFixed(2)})`);
          }
      }
  }

  // Verificar contratos orfãos para somar
  for (const c of contratos) {
      if(!produtos.find(prod => prod.id === c.produto_id)) {
           const valorReal = Number(c.valor_final_venda) || 0;
           valorAcrescido += valorReal;
           console.log(`- Contrato sem unidade vinculada (Adicional puro): R$ ${valorReal.toFixed(2)}`);
      }
  }

  console.log(`\nValor Adicionado por cima da tabela (Vendas Acima do Preço Listado): R$ ${valorAcrescido.toFixed(2)}`);
  console.log(`TOTAL REAL DO EMPREENDIMENTO (Soma Tabela + Valorização de Venda): R$ ${(somaTabelaBruta + valorAcrescido).toFixed(2)}`);
}

run();
