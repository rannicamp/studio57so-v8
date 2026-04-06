require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function pushDiagnostics() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Ticket 98
  await supabase.from('feedback').update({
    diagnostico: 'Ocorreu uma exceção SQL no backend ao executar o RPC unificar_materiais. O erro foi suprimido por um toast genérico do front-end. A causa provável é a violação de Unicidade em tabelas filhas (como orcamentos ou estoque) quando ambos os materiais mesclados já existiam no mesmo contexto, gerando colisões de ID.',
    plano_solucao: '1. Refatorar o RPC unificar_materiais no Banco de Dados para tratar a colisão em orcamento_itens e pedidos_compra_itens (somar as quantidades agrupando o ID em vez de apenas fazer UPDATE). \n2. Atualizar GerenciadorMateriais.js para exibir o erro exato do banco (error.message) no toast.error.'
  }).eq('id', 98);

  // Ticket 99
  await supabase.from('feedback').update({
    diagnostico: 'Falha de chave estrangeira (Foreign Key Constraint). Lançamentos gerados por folha de pagamento/distribuição possuem vínculos em outras tabelas do sistema. O comando frontend .delete() falha para evitar orfandade no banco.',
    plano_solucao: 'Criar uma RPC no banco chamada "excluir_lancamento_cascata", encarregada de apagar dados dependentes e anexos vinculados de forma atômica. Substituir a requisição no handle_delete_lancamento no arquivo app/(main)/financeiro/page.js para acionar essa RPC inteligente.'
  }).eq('id', 99);

  // Ticket 97
  await supabase.from('feedback').update({
    diagnostico: 'Trata-se do Ticket relacionado à sobreposição do Módulo "Braúnas" sendo injetado nos demais simuladores Beta na tela Cxa Entrada.',
    plano_solucao: 'JÁ RESOLVIDO no commit anterior. A regra do Disclaimer Legal foi parametrizada sob o campo Empreendimento.observacoes e o Logo ativado, suprindo este problema visual.',
    status: 'Resolvido'
  }).eq('id', 97);
  
  console.log("Diags pushed");
}
pushDiagnostics();
