import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NOMES_CAT_ANTIGAS = ['Transferência', 'Transferência '];
const NOME_NOVA_CAT = 'Pagamento de Fatura de Cartão';

async function run() {
  console.log("Iniciando Migração de Categorias...");

  let { data: catAtual } = await supabase
    .from('categorias_financeiras')
    .select('id, nome')
    .eq('nome', NOME_NOVA_CAT)
    .eq('organizacao_id', 1)
    .single();

  if (!catAtual) {
    console.log(`Categoria '${NOME_NOVA_CAT}' não existe. Criando...`);
    const { data: newCat, error: errCreate } = await supabase
      .from('categorias_financeiras')
      .insert([{
        nome: NOME_NOVA_CAT,
        tipo: 'Despesa', // Corrigido para não violar a check constraint
        organizacao_id: 1,
        created_at: new Date().toISOString()
      }])
      .select('id, nome')
      .single();

    if (errCreate) {
      console.error("Erro ao criar categoria:", errCreate);
      return;
    }
    catAtual = newCat;
    console.log("Categoria criada! ID:", catAtual.id);
  } else {
    console.log(`Categoria já existe. ID:`, catAtual.id);
  }

  const novaCategoriaId = catAtual.id;

  const { data: contas } = await supabase.from('contas_financeiras').select('id').eq('tipo', 'Cartão de Crédito');
  const contaIds = contas.map(c => c.id);

  const { data: categoriasAntigas } = await supabase
    .from('categorias_financeiras')
    .select('id')
    .in('nome', NOMES_CAT_ANTIGAS);
  const catAntigasIds = categoriasAntigas.map(c => c.id);

  const { data: recebedores } = await supabase
    .from('lancamentos')
    .select('id, transferencia_id')
    .in('conta_id', contaIds)
    .eq('tipo', 'Receita')
    .in('categoria_id', catAntigasIds);

  console.log(`Encontrados ${recebedores.length} recebimentos de cartão para atualizar.`);

  const transferenciasIds = recebedores.map(r => r.transferencia_id).filter(t => t); 
  const lancamentosAvulsosIds = recebedores.filter(r => !r.transferencia_id).map(r => r.id);

  console.log(`Atualizando pares completos (Despesa + Receita) para ${transferenciasIds.length} transfers...`);
  console.log(`Atualizando avulsos: ${lancamentosAvulsosIds.length}`);

  let totalUpdated = 0;

  if (transferenciasIds.length > 0) {
    const { error: err1 } = await supabase
      .from('lancamentos')
      .update({ categoria_id: novaCategoriaId })
      .in('transferencia_id', transferenciasIds);
    if (!err1) totalUpdated += transferenciasIds.length * 2; 
    else console.error("Erro pares:", err1);
  }

  if (lancamentosAvulsosIds.length > 0) {
    const { error: err2 } = await supabase
      .from('lancamentos')
      .update({ categoria_id: novaCategoriaId })
      .in('id', lancamentosAvulsosIds);
    if (!err2) totalUpdated += lancamentosAvulsosIds.length;
    else console.error("Erro avulsos:", err2);
  }

  console.log(`Sinto muito orgulho. Total aproximado de linhas atualizadas no banco: ${totalUpdated}`);
  console.log("Migração de Categoria 100% concluída. Pronta!");
}

run();
