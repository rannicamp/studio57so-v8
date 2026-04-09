require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fetchFeedbacks() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Faltam variáveis de ambiente do Supabase");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: feedbacks, error } = await supabase
      .from('feedback')
      .select(`
        *
            razao_social,
            nome_fantasia
        )
      `)
      .in('status', ['Novo', 'Em Análise'])
      .or('diagnostico.is.null,diagnostico.eq.');

    if (error) {
      throw error;
    }

    console.log(JSON.stringify(feedbacks, null, 2));
  } catch (error) {
    console.error("Erro fetching feedbacks:", error);
  }
}

fetchFeedbacks();
