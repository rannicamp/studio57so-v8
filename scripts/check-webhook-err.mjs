import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs } = await supabase.from('whatsapp_webhook_logs')
    .select('created_at, meta_data')
    .eq('message', 'Webhook Bateu na Porta')
    .order('created_at', { ascending: false })
    .limit(20);

  // Filtrar logs que contêm statuses falhos
  const failedStatuses = logs.filter(log => {
      try {
          // meta_data contém um jsonB
          const body = log.meta_data.body;
          if (body?.entry?.[0]?.changes?.[0]?.value?.statuses) {
              const status = body.entry[0].changes[0].value.statuses[0];
              if (status.status === 'failed') {
                  return true;
              }
          }
      } catch(e) {}
      return false;
  });

  console.log("=== ERROS ASSÍNCRONOS ENCONTRADOS ===");
  if (failedStatuses.length > 0) {
      const err = failedStatuses[0].meta_data.body.entry[0].changes[0].value.statuses[0];
      console.log(JSON.stringify(err, null, 2));
  } else {
      console.log("Nenhum status 'failed' encontrado nos últimos 20 logs.");
  }
}
run();
