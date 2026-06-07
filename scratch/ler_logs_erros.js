const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    console.log("=== LENDO LOGS DE ERROS RECENTES ===");

    // 1. Verificar logs na tabela app_logs
    try {
      const resAppLogs = await client.query(`
        SELECT id, origem, mensagem, payload, created_at 
        FROM public.app_logs 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.log("\n--- ÚLTIMOS LOGS EM app_logs ---");
      console.log(JSON.stringify(resAppLogs.rows, null, 2));
    } catch (e) {
      console.log("Erro ao ler app_logs:", e.message);
    }

    // 2. Verificar logs na tabela logs_erros_ui
    try {
      const resUiLogs = await client.query(`
        SELECT id, mensagem, detalhes, url_atual, created_at 
        FROM public.logs_erros_ui 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.log("\n--- ÚLTIMOS LOGS EM logs_erros_ui ---");
      console.log(JSON.stringify(resUiLogs.rows, null, 2));
    } catch (e) {
      console.log("Erro ao ler logs_erros_ui:", e.message);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
