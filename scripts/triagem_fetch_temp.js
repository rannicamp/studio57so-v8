require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fetchTrueNames() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro feedback", error);
    return;
  }

  for (let f of feedbacks) {
    f.autor_nome = 'Desconhecido';
    if (f.usuario_id) {
       // Query public.usuarios
       const { data: usr } = await supabase.from('usuarios').select('nome, email').eq('id', f.usuario_id).single();
       if (usr && usr.nome) {
         f.autor_nome = usr.nome;
       } else if (usr && usr.email) {
         f.autor_nome = usr.email;
       } else {
         const { data: func } = await supabase.from('funcionarios').select('nome').eq('usuario_id', f.usuario_id).single();
         if (func && func.nome) {
             f.autor_nome = func.nome;
         }
       }
    }
  }

  const result = feedbacks.map(f => ({
    id: f.id,
    data: new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    autor: f.autor_nome,
    descricao: (f.descricao || '').substring(0, 50) + '...',
    pagina: f.pagina,
    diagnostico: f.diagnostico,
    plano: f.plano_solucao
  }));

  console.log(JSON.stringify(result, null, 2));
}

fetchTrueNames();
