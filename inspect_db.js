require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  try {
    console.log("=== HISTORICO MOVIMENTACAO ===");
    const { data: movements, error: mErr } = await supabase.from('historico_movimentacao_funil')
      .select('id, contato_no_funil_id, coluna_anterior_id, coluna_nova_id, data_movimentacao, usuario_id')
      .order('data_movimentacao', { ascending: true });
    if (mErr) console.error(mErr);
    else console.log(movements.slice(-15)); // print last 15 movements

  } catch(e) {
    console.error(e);
  }
}

run();
