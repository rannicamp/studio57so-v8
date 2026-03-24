require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select(`
      id,
      descricao,
      pagina,
      status,
      diagnostico,
      plano_solucao,
      created_at,
      usuario_id,
      organizacao_id
    `)
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log('=== FEEDBACKS PENDENTES DE DIAGNÓSTICO (NOVOS BUGS) ===');
  console.log(JSON.stringify(feedbacks, null, 2));
}
run();
