require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Credenciais do Supabase não encontradas no .env.local");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch feedbacks that need triagem
    const { data: feedbacks, error } = await supabase
      .from('feedback')
      .select(`
        id, 
        status, 
        created_at, 
        usuario_id, 
        pagina, 
        descricao, 
        imagem_url,
        diagnostico,
        plano_solucao
      `)
      .in('status', ['Novo', 'Em Análise'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Erro ao buscar feedbacks:", error);
      return;
    }

    // Filter out the ones that already have diagnostico
    const pendentes = feedbacks.filter(f => !f.diagnostico || f.diagnostico.trim() === '');

    // Get user names for the pendentes
    for (let i = 0; i < pendentes.length; i++) {
      const f = pendentes[i];
      if (f.usuario_id) {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(f.usuario_id);
        if (!userError && userData && userData.user) {
          f.autor_nome = userData.user.user_metadata?.nome_completo || userData.user.email;
        } else {
          f.autor_nome = f.usuario_id; // fallback
        }
      } else {
        f.autor_nome = 'Desconhecido';
      }
    }

    console.log(JSON.stringify(pendentes, null, 2));

  } catch (err) {
    console.error("Erro:", err);
  }
}

run();
