require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('URL ou Key do Supabase não encontradas.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: firstRow, error } = await supabase
      .from('contatos')
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log("Colunas da tabela contatos:", Object.keys(firstRow[0]).join(', '));
    
    const { data: leadsToday, error: e2 } = await supabase
      .from('contatos')
      .select('id, created_at, nome, pipeline_etapa_id, tags')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (e2) throw e2;
    console.table(leadsToday);

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();
