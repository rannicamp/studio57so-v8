import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabase.from('whatsapp_webhook_logs')
    .select('created_at, log_level, message')
    .ilike('message', '%wamid%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log("=== LOGS WEBHOOK COM WAMID (Status assíncronos) ===");
  console.log(JSON.stringify(logs, null, 2));
  
  // E também o erro específico salvo na msg 11618, se houver error_message completo:
  const { data: msg } = await supabase.from('whatsapp_messages').select('error_message').eq('id', 11618).single();
  console.log("Error Msg DB:", msg);
}
run();
