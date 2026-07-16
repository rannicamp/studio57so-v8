// scratch_inspect_recent_messages.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('--- BUSCANDO ÚLTIMAS MENSAGENS DO INSTAGRAM ---');
  const { data: msgs, error: errMsgs } = await supabase
    .from('instagram_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (errMsgs) {
    console.error('Erro:', errMsgs.message);
  } else {
    console.log(JSON.stringify(msgs, null, 2));
  }

  console.log('\n--- BUSCANDO ÚLTIMAS CONVERSAS DO INSTAGRAM ---');
  const { data: convs, error: errConvs } = await supabase
    .from('instagram_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (errConvs) {
    console.error('Erro:', errConvs.message);
  } else {
    console.log(JSON.stringify(convs, null, 2));
  }
}

run();
