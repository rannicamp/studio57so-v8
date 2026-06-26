// scratch/checar_tipos_id.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== COMPARAÇÃO DE TIPAGEM DE IDs ===");

  // Buscar o contato da Stella
  const { data: stellaUser } = await supabase
    .from('usuarios')
    .select('id, contato_id')
    .eq('email', 'stella.org2@elo57.com.br')
    .maybeSingle();

  // Buscar o lead da Sarah no funil
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select('corretor_id')
    .eq('contato_id', 5976)
    .limit(1);

  const stellaContatoId = stellaUser?.contato_id;
  const leadCorretorId = funil?.[0]?.corretor_id;

  console.log(`stellaContatoId: ${stellaContatoId} (Tipo: ${typeof stellaContatoId})`);
  console.log(`leadCorretorId: ${leadCorretorId} (Tipo: ${typeof leadCorretorId})`);
  console.log(`stellaContatoId !== leadCorretorId: ${stellaContatoId !== leadCorretorId}`);
}

main();
