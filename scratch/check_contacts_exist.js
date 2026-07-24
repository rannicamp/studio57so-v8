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
  const { data: contacts, error } = await supabase
    .from('contatos')
    .select('id, nome, organizacao_id, lixeira, created_at')
    .in('id', [6576, 6577]);

  if (error) {
    console.error("Error fetching contacts:", error.message);
    return;
  }

  console.log("=== Contacts check ===");
  console.log(contacts);
}

main();
