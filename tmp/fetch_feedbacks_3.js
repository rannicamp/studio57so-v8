require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
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
    
    if (f.usuario_id) {
       const func = (funcs || []).find(func => func.auth_user_id === f.usuario_id);
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
      descricao: f.descricao,
      pagina: f.pagina,
      captura_de_tela_url: f.captura_de_tela_url,
      imagem_url: f.imagem_url,
      link_opcional: f.link_opcional,
      created_at: f.created_at,
      userName,
      orgName
    };
  });

  console.log(JSON.stringify(formattedFeedbacks, null, 2));
}

run();
