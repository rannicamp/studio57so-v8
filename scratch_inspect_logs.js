const { Client } = require('pg');
const connStr = 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    
    console.log("=== LOGS DE ERRO OU AVISOS DE HOJE ===");
    const { rows } = await client.query(`
      SELECT created_at, origem, mensagem, payload, organizacao_id, usuario_id
      FROM public.app_logs
      WHERE created_at >= '2026-07-16 00:00:00+00'
      ORDER BY created_at DESC
      LIMIT 100;
    `);
    
    console.log(JSON.stringify(rows, null, 2));

  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    await client.end();
  }
}

run();
