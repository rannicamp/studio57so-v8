const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count: cCount } = await supabase.from('contatos').select('*', { count: 'exact', head: true }).eq('organizacao_id', 2);
  const { count: fCount } = await supabase.from('contatos_no_funil').select('*', { count: 'exact', head: true }).eq('organizacao_id', 2);
  const { count: mCount } = await supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('organizacao_id', 2);

  console.log(`Total contatos (Org 2): ${cCount}`);
  console.log(`Total contatos_no_funil (Org 2): ${fCount}`);
  console.log(`Total messages (Org 2): ${mCount}`);
}

main();
