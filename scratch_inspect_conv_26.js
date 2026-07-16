// scratch_inspect_conv_26.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('--- BUSCANDO MENSAGENS DA CONVERSA ID 26 ---');
  const { data: msgs, error } = await supabase
    .from('instagram_messages')
    .select('*')
    .eq('conversation_id', 26)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro:', error.message);
  } else {
    console.log(JSON.stringify(msgs, null, 2));
  }
}

run();
