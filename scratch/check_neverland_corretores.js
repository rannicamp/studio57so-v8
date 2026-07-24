const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: cards, error } = await supabase
    .from('contatos_no_funil')
    .select('id, contato_id, coluna_id, corretor_id, created_at, updated_at')
    .in('contato_id', [6576, 6577]);

  if (error) {
    console.error("Error fetching cards:", error.message);
    return;
  }

  console.log("=== Cards in funil for 6576 and 6577 ===");
  console.log(JSON.stringify(cards, null, 2));

  // Also fetch the name of corretor_id
  const corretorIds = [...new Set(cards.map(c => c.corretor_id).filter(Boolean))];
  if (corretorIds.length > 0) {
    const { data: corretores } = await supabase
      .from('contatos')
      .select('id, nome')
      .in('id', corretorIds);
    console.log("=== Corretores metadata ===");
    console.log(corretores);
  }
}

main();
