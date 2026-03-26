import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabaseAdmin.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('message', 'Webhook Bateu na Porta')
    .order('created_at', { ascending: false })
    .limit(100);

  const errors = [];
  logs?.forEach(log => {
      try {
          const body = log.meta_data.body;
          if (body?.entry) {
              for (const entry of body.entry) {
                  const val = entry.changes?.[0]?.value;
                  if (val?.statuses) {
                      for (const st of val.statuses) {
                          if (st.status === 'failed') {
                              errors.push({ time: log.created_at, error: st.errors });
                          }
                      }
                  }
              }
          }
      } catch(e) {}
  });

  console.log("=== TODOS OS ERROS ASSÍNCRONOS RECENTES ===");
  console.log(JSON.stringify(errors, null, 2));
}
run();
