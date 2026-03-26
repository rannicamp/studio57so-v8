import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: msgs, error } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_record_id')
    .is('contato_id', null)
    .not('conversation_record_id', 'is', null);
    
  if (error) { console.error(error); return; }
  
  console.log(`Encontradas ${msgs.length} mensagens com contato nulo. Corrigindo...`);
  let fixedCount = 0;
  for (const m of msgs) {
    const { data: conv } = await supabase.from('whatsapp_conversations').select('contato_id').eq('id', m.conversation_record_id).single();
    if (conv && conv.contato_id) {
       await supabase.from('whatsapp_messages').update({ contato_id: conv.contato_id }).eq('id', m.id);
       fixedCount++;
    }
  }
  console.log(`✔️ ${fixedCount} mensagens corrigidas para aparecerem na interface de Chat!`);
}
fix();
