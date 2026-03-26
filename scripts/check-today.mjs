import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const { data: inbound } = await supabase.from('whatsapp_messages')
    .select('id, content, created_at')
    .eq('direction', 'inbound')
    .gte('created_at', today.toISOString());
    
  console.log("=== MENSAGENS INBOUND RECEBIDAS HOJE ===");
  console.log(inbound);
  
  const { data: webhookLogs } = await supabase.from('whatsapp_webhook_logs')
    .select('created_at, log_level, message')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log("\n=== LOGS DO WEBHOOK HOJE ===");
  console.log(webhookLogs);
}
run();
