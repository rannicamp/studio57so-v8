// scratch/test_query_stella.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const contatoId = 6067;
  
  console.log("=== ÚLTIMAS MENSAGENS GERAIS ===");
  const { data: msgs, error } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, content, created_at')
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(msgs);

  console.log("\n=== ÚLTIMA MENSAGENS INBOUND ===");
  const { data: inboundMsgs } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, content, created_at')
    .eq('contato_id', contatoId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(inboundMsgs);
}

main();
