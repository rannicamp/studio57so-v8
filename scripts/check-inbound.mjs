import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: msgs } = await supabase.from('whatsapp_messages')
    .select('id, content, direction, created_at, organizacao_id, conversation_record_id, contato_id')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("Últimas Inbound Msgs:");
  console.log(msgs);

  const { data: logs } = await supabase.from('whatsapp_webhook_logs')
    .select('created_at, log_level, message')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("\nÚltimos Webhook logs:");
  console.log(logs);
}
run();
