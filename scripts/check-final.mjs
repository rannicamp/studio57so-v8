import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== ÚLTIMOS ERROS DO WEBHOOK ===");
  const { data: logs } = await supabase
    .from('whatsapp_webhook_logs')
    .select('created_at, log_level, message')
    .in('log_level', ['ERROR', 'FATAL', 'WARNING'])
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n=== ÚLTIMAS MENSAGENS SALVAS NO BANCO ===");
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('created_at, body, direction, status')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(msgs, null, 2));
}

check();
