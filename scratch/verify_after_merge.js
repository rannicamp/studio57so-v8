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
  console.log("=== Verification After Merge ===");

  // 1. Fetch contact 6576
  const { data: contactWinner } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', 6576)
    .maybeSingle();

  console.log("Winner Contact 6576:", contactWinner);

  // 2. Fetch contact 6577 (should be null/deleted)
  const { data: contactLoser } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', 6577)
    .maybeSingle();

  console.log("Loser Contact 6577 (should be null):", contactLoser);

  // 3. Fetch phone numbers for 6576 (should have both 556174016736 and 553397339003)
  const { data: phones } = await supabase
    .from('telefones')
    .select('*')
    .eq('contato_id', 6576);

  console.log("Phones for 6576:", phones);

  // 4. Fetch whatsapp conversations for 6576 (should have the conversation from 6577)
  const { data: convs } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('contato_id', 6576);

  console.log("Conversations for 6576:", convs);

  // 5. Fetch cards in funil for 6576 (should have only 1 active card)
  const { data: cards } = await supabase
    .from('contatos_no_funil')
    .select('*')
    .eq('contato_id', 6576);

  console.log("Cards in funil for 6576:", cards);
}

main();
