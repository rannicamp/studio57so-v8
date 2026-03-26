import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('message, log_level, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log("=== TODOS OS LOGS ===");
  console.log(logs);
}
run();
