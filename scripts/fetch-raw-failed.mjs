import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('id, created_at, meta_data')
    .order('created_at', { ascending: false })
    .limit(50);
    
  let found = 0;
  for (const log of (logs||[])) {
      const str = JSON.stringify(log.meta_data);
      if (str.includes('"failed"')) {
          console.log("ACHOU UM FAILED EM:", log.created_at);
          console.log(JSON.stringify(log.meta_data, null, 2).substring(0, 1000));
          found++;
      }
  }
  if (!found) console.log("Nunca recebeu a palavra 'failed' nos últimos 50 webhooks!");
}
run();
