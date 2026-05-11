require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: corretores, error } = await supabase
      .from('contatos')
      .select('id, nome, razao_social')
      .in('id', [5322, 3690]);

    if (error) throw error;
    console.table(corretores);

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();
