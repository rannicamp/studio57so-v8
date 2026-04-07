require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao(id, diagnostico, solucao) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('feedback')
    .update({ diagnostico, plano_solucao: solucao })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  } else {
    console.log("Triagem gravada com sucesso via SDK.");
  }
}

const diag = "O erro de banco ('violates foreign key constraint') ao tentar excluir ocorre porque a tabela auditora 'historico_lancamentos_financeiros' possui uma chave estrangeira apontando para a tabela 'lancamentos_financeiros' que restringe a exclusão. O banco de dados impede a deleção do lançamento-pai enquanto existir histórico atrelado a ele.";
const sol = "Escrever e executar uma migration SQL que modifique a Foreign Key `historico_lancamentos_financeiros_lancamento_id_fkey` na tabela `historico_lancamentos_financeiros`, adicionando a diretriz `ON DELETE CASCADE`. Isso garantirá a deleção do histórico associado automaticamente pelo banco sem bloquear as operações de exclusão no frontend.";

runAtualizacao(100, diag, sol).catch(e => console.error("Erro na triagem:", e));
