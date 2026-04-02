import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Buscando contas de Cartão de Crédito...");
  const { data: contasCartao, error: errContas } = await supabase
    .from('contas_financeiras')
    .select('id, nome, tipo')
    .eq('tipo', 'Cartão de Crédito')
    .eq('organizacao_id', 1); // Org do Ranniere
    
  if (errContas) {
      console.error(errContas);
      return;
  }
    
  if (!contasCartao || contasCartao.length === 0) {
    console.log("Nenhuma conta de cartão de crédito encontrada.");
    return;
  }
  
  const contaIds = contasCartao.map(c => c.id);
  console.log(`Encontradas ${contaIds.length} contas de cartão.`);
  
  const { data: lancamentos, error: errLanc } = await supabase
    .from('lancamentos')
    .select('id, descricao, valor, data_transacao, status, transferencia_id, conta_id, fatura_id, categoria_id, categorias_financeiras(nome)')
    .in('conta_id', contaIds)
    .eq('tipo', 'Receita')
    .order('data_transacao', { ascending: false });
    
  if (errLanc) {
      console.error(errLanc);
      return;
  }
    
  console.log(`Encontrados ${lancamentos.length} lançamentos de ENTRADA (Receita/Pagamento) nos Cartões.`);
  
  let temTransferenciaId = 0;
  let temFaturaId = 0;
  const categoriesCount = {};
  
  lancamentos.forEach(l => {
      if (l.transferencia_id) temTransferenciaId++;
      if (l.fatura_id) temFaturaId++;
      
      const catName = l.categorias_financeiras ? l.categorias_financeiras.nome : 'Sem Categoria Relacional';
      categoriesCount[catName] = (categoriesCount[catName] || 0) + 1;
  });

  console.log("\n==== RESUMO DOS DADOS ====");
  console.log(`- Total de Entradas nos Cartões: ${lancamentos.length}`);
  console.log(`- Com 'transferencia_id' preenchido formalmente: ${temTransferenciaId}`);
  console.log(`- Com 'fatura_id' preenchido formalmente: ${temFaturaId}`);
  
  console.log("\n==== DISTRIBUIÇÃO POR CATEGORIA ====");
  Object.keys(categoriesCount).forEach(k => {
      console.log(`- ${k}: ${categoriesCount[k]} vezes`);
  });
  
  console.log("\n==== ÚLTIMOS 5 LANÇAMENTOS (AMOSTRAGEM) ====");
  console.dir(lancamentos.slice(0, 5), { depth: null });
}

run();
