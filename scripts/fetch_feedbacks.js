require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: feedbacks, error: errFeedbacks } = await supabase
      .from('feedback')
      .select('*, usuarios(nome)')
      .in('status', ['Novo', 'Em Análise'])
      .or('diagnostico.is.null,diagnostico.eq.""');

    if (errFeedbacks) throw errFeedbacks;

    const formatted = feedbacks.map(f => {
      let autor = f.usuario_id;
      if (f.usuarios) {
        autor = f.usuarios.nome || f.usuario_id;
      }
      return { ...f, autor_nome: autor };
    });

    console.log(JSON.stringify(formatted, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}
run();
