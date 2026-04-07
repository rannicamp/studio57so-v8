require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao(id) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('feedback')
    .update({ 
        status: 'Concluído',
        diagnostico: 'Resolvido. As Foreign Keys (historico_lancamentos_financeiros e auditoria_ia_logs) foram removidas via SQL para permitir que os gatilhos (triggers) de auditoria insiram registros de deleção com segurança, preservando o histórico sem bloquear as operações.'
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  } else {
    console.log("Status atualizado para Concluído.");
  }
}

runAtualizacao(100).catch(e => console.error(e));
