require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runTriagem() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const updates = [
    {
      id: 71,
      diagnostico: "Teste de upload de imagem feito pelo usuário. Nenhuma anomalia técnica real.",
      solucao: "Desconsiderar o chamado e alterar o status para 'Concluído' ou 'Desconsiderado'."
    },
    {
      id: 72,
      diagnostico: "A trigger 'fn_vincular_lancamento_fatura' está invocando campos inexistentes na tabela 'financeiro_lancamentos' (NEW.conta_origem_id e NEW.conta_destino_id) em vez do correto 'NEW.conta_id'. Isso gera o código de erro Postgres 08P01 ou 'has no field' em qualquer tentativa de edição ou criação de despesa no cartão.",
      solucao: "Atualizar a função PL/pgSQL no banco de dados substituindo a verificação de 'conta_origem_id' por 'conta_id', que é a coluna real da tabela."
    },
    {
      id: 70,
      diagnostico: "1. Edição: Falha pelo mesmo motivo do ticket 72 (a trigger interrompe o UPDATE do backend). 2. Exclusão: Ocorre uma violação de chave estrangeira porque a tabela 'banco_transacoes_ofx' aponta para o lançamento. O Supra-ORM do Supabase bloqueia a exclusão do pai se o filho (OFX) ainda existir.",
      solucao: "1. Corrigir a trigger de faturas (ticket 72) resolverá a edição. 2. Para a exclusão, deve-se alterar a exclusão no 'LancamentosManager.js' para primeiro desvincular o registro em 'banco_transacoes_ofx' (setar lancamento_id = null) antes de deletar no banco principal, ou adicionar 'ON DELETE CASCADE' na Foreign Key do supabase."
    }
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from('feedback')
      .update({
        diagnostico: update.diagnostico,
        plano_solucao: update.solucao,
        status: 'Em Análise' // Move to Em Análise as it's been triaged
      })
      .eq('id', update.id);
      
    if (error) {
      console.error(`Erro ao atualizar ticket ${update.id}:`, error.message);
    } else {
      console.log(`Ticket ${update.id} atualizado com sucesso com a Inteligência Artificial.`);
    }
  }
}

runTriagem().catch(console.error);
