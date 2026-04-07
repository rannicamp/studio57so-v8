require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fetchFeedbacks() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .or('diagnostico.is.null,diagnostico.eq.');

  if (error) {
    console.error("Error fetching feedback:", error);
    return;
  }

  for (let f of feedbacks) {
    if (f.autor_id) {
       const { data: func } = await supabase.from('funcionarios').select('nome_display, user_id').eq('user_id', f.autor_id).single();
       f.autor_nome = func ? func.nome_display : 'Desconhecido';
    }
    if (f.organizacao_id) {
       const { data: org } = await supabase.from('organizacoes').select('entidade_principal_id').eq('id', f.organizacao_id).single();
       if (org && org.entidade_principal_id) {
          const { data: emp } = await supabase.from('cadastro_empresa').select('razao_social, nome_fantasia').eq('id', org.entidade_principal_id).single();
          f.org_nome = emp ? (emp.nome_fantasia || emp.razao_social) : 'Desconhecida';
       }
    }
  }

  console.log(JSON.stringify(feedbacks, null, 2));
}

fetchFeedbacks();
