import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('created_at', '2026-03-26T13:24:00.232005+00:00')
    .single();

  console.log("=== LOG DAS 13:24:00 ===");
  console.log(JSON.stringify(logs.meta_data, null, 2));
}
run();
