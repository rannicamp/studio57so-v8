import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: failedMsgs } = await supabase.from('whatsapp_messages')
    .select('id, content, status, raw_payload, error_message, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log("=== ÚLTIMAS MENSAGENS FALHAS (DEPOIS DA CORREÇÃO) ===");
  console.log(JSON.stringify(failedMsgs, null, 2));

  // Buscar erros assíncronos no log do webhook nos ultimos 10 mins
  const { data: logs } = await supabase.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('message', 'Webhook Bateu na Porta')
    .order('created_at', { ascending: false })
    .limit(20);

  const errors = [];
  logs?.forEach(log => {
      try {
          const body = log.meta_data.body;
          if (body?.entry?.[0]?.changes?.[0]?.value?.statuses) {
              const status = body.entry[0].changes[0].value.statuses[0];
              if (status.status === 'failed') {
                  errors.push(status);
              }
          }
      } catch(e) {}
  });

  console.log("=== ERROS NO WEBHOOK (ASYNC) ===");
  console.log(JSON.stringify(errors, null, 2));
}
run();
