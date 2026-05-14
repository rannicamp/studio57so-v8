require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao(id, diagnostico, solucao) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.from('feedback')
    .update({
      diagnostico: diagnostico,
      plano_solucao: solucao,
      status: 'Em Análise',
      comentarios: 'Ticket analisado como teste/demonstração. Aguardando confirmação para encerramento.'
    })
    .eq('id', id);

  if (error) {
    console.error("Erro:", error);
  } else {
    console.log("Atualizado ticket " + id);
  }
}

runAtualizacao(138, "O ticket parece ser um registro de teste ou nota de demonstração do usuário, não relatando uma falha técnica real no sistema.", "Nenhuma alteração estrutural no código é necessária. Sugere-se o encerramento do ticket visto tratar-se de um teste de demonstração.");
