require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: cols } = await supabase.from('sys_chat_conversations').select('*').limit(1);
  console.log('conversations:', cols);
  
  const { data: pcols } = await supabase.from('sys_chat_participants').select('*').limit(1);
  console.log('participants (sys_chat_participants):', pcols);

  const { data: pcols2 } = await supabase.from('sys_chat_conversation_participants').select('*').limit(1);
  console.log('participants (sys_chat_conversation_participants):', pcols2);
}
run();
