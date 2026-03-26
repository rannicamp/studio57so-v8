import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('message', 'Webhook Bateu na Porta')
    .gte('created_at', '2026-03-26T12:50:28.000000+00:00')
    .lte('created_at', '2026-03-26T12:51:30.000000+00:00')
    .order('created_at', { ascending: true });

  console.log("=== WEKHOOKS ENTRE 12:50:28 e 12:51:30 ===");
  for (const log of (logs||[])) {
      console.log(log.created_at, JSON.stringify(log.meta_data).substring(0, 150));
      // tenta achar error especifico
      const body = log.meta_data.body;
      if (body?.entry) {
          for (const entry of body.entry) {
              const val = entry.changes?.[0]?.value;
              if (val?.statuses) {
                  for (const st of val.statuses) {
                      if (st.status === 'failed') {
                          console.log("-> ACHEI O ERRO ASSÍNCRONO NESTE LOG:");
                          console.log(JSON.stringify(st, null, 2));
                      }
                  }
              }
          }
      }
  }
}
run();
