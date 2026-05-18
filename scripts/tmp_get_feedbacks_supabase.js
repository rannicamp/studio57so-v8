require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('URL ou Key não encontrados');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Buscando feedbacks com status Novo ou Em Análise que não tenham diagnóstico
  const { data, error } = await supabase
    .from('feedback')
    .select(`
      *,
      usuarios:usuario_id (nome, email)
    `)
    .in('status', ['Novo', 'Em Análise'])
    .or('diagnostico.is.null,diagnostico.eq.""');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
