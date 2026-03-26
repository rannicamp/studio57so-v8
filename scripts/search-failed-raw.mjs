import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('id, created_at, meta_data')
    .order('created_at', { ascending: false })
    .limit(500);

  let c = 0;
  for (const log of (logs||[])) {
      const str = JSON.stringify(log.meta_data);
      if (str.includes('"failed"')) {
          console.log(`[${log.created_at}] ACHOU A PALAVRA FAILED NO WEBHOOK!`);
          console.log(JSON.stringify(log.meta_data, null, 2).substring(0, 300));
          c++;
      }
  }
  if (!c) console.log("NENHUM LOG COM A PALAVRA 'failed' HOJE!");
}
run();
