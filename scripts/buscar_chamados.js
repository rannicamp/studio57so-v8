require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function buscarChamados() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: feedbacks, error } = await supabase
      .from('feedback')
      .select('*')
      .in('status', ['Novo', 'Em Análise'])
      .or('diagnostico.is.null,diagnostico.eq.');

    if (error) {
      console.error("Erro do Supabase:", error);
      return;
    }

    if (!feedbacks || feedbacks.length === 0) {
      console.log(JSON.stringify([], null, 2));
      return;
    }

    // Para cada feedback, buscar nome do usuário e empresa
    for (let f of feedbacks) {
      if (f.usuario_id) {
        const { data: func } = await supabase.from('funcionarios').select('nome').eq('auth_id', f.usuario_id).single();
        if (func) f.funcionario_nome = func.nome;
      }
      if (f.organizacao_id) {
         const { data: emp } = await supabase.from('cadastro_empresa').select('nome_fantasia, nome_empresarial').eq('id', f.organizacao_id).single();
         if (emp) f.empresa_nome = emp.nome_fantasia || emp.nome_empresarial;
      }
    }

    console.log(JSON.stringify(feedbacks, null, 2));
  } catch (err) {
    console.error("Exceção:", err);
  }
}

buscarChamados();
