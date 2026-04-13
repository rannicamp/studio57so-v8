require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .or('diagnostico.is.null,diagnostico.eq.null,diagnostico.eq.""');

  if (error) {
    console.error('Erro fetching feedbacks:', error);
    return;
  }

  // Get user info and org info via simple additional queries
  const result = [];
  for (const f of feedbacks) {
    // Determine creator column, could be 'criado_por_usuario_id', 'usuario_id', 'created_by'
    const userId = f.criado_por_usuario_id || f.usuario_id || f.created_by;
    
    let userName = userId;
    if (userId) {
        // use auth.users or funcionarios? Rest API can't access auth.users directly. 
        // We will query funcionarios:
        const { data: func } = await supabase.from('funcionarios').select('nome').eq('user_id', userId).single();
        if (func) userName = func.nome;
    }

    let orgName = f.organizacao_id;
    if (f.organizacao_id) {
        const { data: org } = await supabase.from('cadastro_empresa').select('nome_fantasia').eq('organizacao_id', f.organizacao_id).single();
        if (org) orgName = org.nome_fantasia;
    }

    result.push({
      id: f.id,
      titulo: f.titulo || 'Sem titulo',
      descricao: f.descricao,
      pagina: f.pagina,
      status: f.status,
      gravidade: f.gravidade,
      anexo_url: f.anexo_url,
      organizacao_id: f.organizacao_id,
      user_id: userId,
      userName: userName,
      orgName: orgName
    });
  }

  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
