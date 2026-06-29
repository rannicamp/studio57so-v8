// scratch/testar_query_funil.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: funil, error } = await supabase
    .from('funis')
    .select('id')
    .eq('organizacao_id', 2)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle();

  console.log("Resultado com 'criado_em':", funil);
  console.log("Erro com 'criado_em':", error);

  const { data: funil2, error: error2 } = await supabase
    .from('funis')
    .select('id')
    .eq('organizacao_id', 2)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  console.log("Resultado com 'created_at':", funil2);
  console.log("Erro com 'created_at':", error2);
}
main();
