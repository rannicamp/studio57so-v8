import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('message', 'Webhook Bateu na Porta')
    .gte('created_at', '2026-03-26T13:23:00.000000+00:00')
    .lte('created_at', '2026-03-26T13:25:00.000000+00:00')
    .order('created_at', { ascending: true });

  console.log("=== WEKHOOKS ENTRE 13:23 e 13:25 ===");
  for (const log of (logs||[])) {
      const body = log.meta_data.body;
      if (body?.entry) {
          for (const entry of body.entry) {
              const val = entry.changes?.[0]?.value;
              if (val?.statuses) {
                  for (const st of val.statuses) {
                      if (st.status === 'failed') {
                          console.log(`[${log.created_at}] -> ERRO ASSÍNCRONO ENCONTRADO!`);
                          console.log(JSON.stringify(st, null, 2));
                      }
                  }
              }
          }
      }
  }
}
run();
