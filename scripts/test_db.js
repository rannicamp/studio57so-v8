require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const contas = await supabase.from('contas_financeiras').select('id, nome, tipo').limit(15);
  console.log("Contas: ", contas.data);

  const categorias = await supabase.from('categorias_financeiras').select('id, nome, tipo, parent_id').limit(15);
  console.log("Categorias: ", categorias.data);
}

main();
