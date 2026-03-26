import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabase.from('whatsapp_webhook_logs').select('created_at, log_level, message').order('created_at', { ascending: false }).limit(3);
  console.log("=== ÚLTIMOS LOGS DO WEBHOOK ===");
  console.log(logs);

  const { data: msgs } = await supabase.from('whatsapp_messages').select('created_at, content, direction').eq('direction', 'inbound').order('created_at', { ascending: false }).limit(3);
  console.log("\n=== ÚLTIMAS MENSAGENS RECEBIDAS ===");
  console.log(msgs);
}
run();
