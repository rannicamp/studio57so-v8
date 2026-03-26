import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: conv } = await supabase.from('whatsapp_conversations').select('id, organizacao_id, contato_id, updated_at').in('id', [10202, 10321]);
  console.log("Conversas:", conv);

  const { data: msg } = await supabase.from('whatsapp_messages').select('id, organizacao_id, content, direction, created_at').eq('conversation_record_id', 10202).order('created_at', {ascending: false}).limit(5);
  console.log("Mensagens Conv 10202:", msg);
}
check();
