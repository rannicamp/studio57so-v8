// scripts/check-logs-recentes.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== VERIFICANDO LOGS DE ERRO RECENTES (ÚLTIMOS 3 DIAS) ===\n');

  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
  const dataCorte = tresDiasAtras.toISOString();

  // 1. Erros na tabela app_logs
  console.log('--- Buscando erros na tabela app_logs ---');
  const { data: appLogs, error: appErr } = await supabase
    .from('app_logs')
    .select('id, origem, mensagem, payload, created_at')
    .gte('created_at', dataCorte)
    .or('origem.ilike.%error%,origem.ilike.%fail%,mensagem.ilike.%error%,mensagem.ilike.%fail%,mensagem.ilike.%timeout%')
    .order('created_at', { ascending: false })
    .limit(20);

  if (appErr) {
    console.error('Erro ao buscar app_logs:', appErr.message);
  } else {
    console.log(`Encontrados ${appLogs.length} logs de erro em app_logs:\n`);
    appLogs.forEach(log => {
      console.log(`[${new Date(log.created_at).toLocaleString('pt-BR')}] Origem: "${log.origem}"`);
      console.log(`Mensagem: "${log.mensagem}"`);
      console.log('Payload:', JSON.stringify(log.payload, null, 2));
      console.log('------------------------------------------------------------\n');
    });
  }

  // 2. Erros de processamento nos logs do webhook
  console.log('--- Buscando erros/falhas no whatsapp_webhook_logs ---');
  const { data: webhookLogs, error: webErr } = await supabase
    .from('whatsapp_webhook_logs')
    .select('id, message, payload, created_at')
    .gte('created_at', dataCorte)
    .order('created_at', { ascending: false })
    .limit(20);

  if (webErr) {
    console.error('Erro ao buscar webhook logs:', webErr.message);
  } else {
    const errorWebhooks = [];
    webhookLogs?.forEach(log => {
      // Procurar por chaves de erro ou payloads de erro de entrega
      const body = log.payload?.body || log.payload;
      if (JSON.stringify(body).toLowerCase().includes('error') || log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail')) {
        errorWebhooks.push(log);
      }
    });

    console.log(`Encontrados ${errorWebhooks.length} logs de webhook com indício de falha/erro:\n`);
    errorWebhooks.forEach(log => {
      console.log(`[${new Date(log.created_at).toLocaleString('pt-BR')}] Mensagem de Log: "${log.message}"`);
      console.log('Payload:', JSON.stringify(log.payload, null, 2));
      console.log('------------------------------------------------------------\n');
    });
  }
}

run().catch(console.error);
