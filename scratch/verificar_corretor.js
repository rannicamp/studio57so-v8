// scratch/verificar_corretor.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== VERIFICANDO CORRETOR ID 5792 E STELLA IA ===");

  // 1. Buscar o usuário com ID 5792
  const { data: user5792 } = await supabase
    .from('usuarios')
    .select('id, nome, email, contato_id')
    .eq('id', 5792)
    .maybeSingle();

  console.log("Usuário ID 5792:");
  console.log(user5792);

  // 2. Buscar usuários da Stella
  const { data: stellas } = await supabase
    .from('usuarios')
    .select('id, nome, email, contato_id')
    .like('email', 'stella%');

  console.log("\nUsuários com email 'stella%':");
  console.table(stellas);
}

main();
