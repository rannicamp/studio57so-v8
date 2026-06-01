require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    console.log("=== BUSCANDO LOGS DE WEBHOOK DE LEADS RECENTES ===");
    const { data: logs, error } = await supabase
      .from('whatsapp_webhook_logs')
      .select('*')
      .gte('created_at', '2026-06-01T17:00:00+00:00')
      .lte('created_at', '2026-06-01T17:15:00+00:00')
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    console.log(`Encontrados ${logs ? logs.length : 0} logs:`);
    for (const log of logs) {
      console.log(`[${log.created_at}] [${log.log_level}] ${log.message}`);
      console.log("Payload:", JSON.stringify(log.payload, null, 2));
      console.log("-".repeat(40));
    }
  } catch (e) {
    console.error("Erro:", e);
  }
}

run();
