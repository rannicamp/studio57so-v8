require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select(`
      id, titulo, descricao, pagina, screenshot_url, status, diagnostico,
      criado_em, criado_por_usuario_id
    `)
    .eq('status', 'Novo')
    .filter('diagnostico', 'is', 'null');

  if (error) {
    console.error('Error fetching feedbacks:', error);
    return;
  }

  const { data: orgs } = await supabase.from('cadastro_empresa').select('id, razao_social, organizacao_id');
  const { data: funcs } = await supabase.from('funcionarios').select('id, nome, auth_user_id, organizacao_id');

  const formattedFeedbacks = feedbacks.map(f => {
    let userName = 'Desconhecido';
    let orgName = 'Desconhecido';
    
    if (f.criado_por_usuario_id) {
       const func = (funcs || []).find(func => func.auth_user_id === f.criado_por_usuario_id);
       if (func) {
         userName = func.nome;
         if (func.organizacao_id) {
           const org = (orgs || []).find(o => o.organizacao_id === func.organizacao_id);
           if (org) orgName = org.razao_social || 'Desconhecida';
         }
       }
    }

    return {
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      pagina: f.pagina,
      screenshot_url: f.screenshot_url,
      criado_em: f.criado_em,
      userName,
      orgName
    };
  });

  console.log(JSON.stringify(formattedFeedbacks, null, 2));
}

run();
