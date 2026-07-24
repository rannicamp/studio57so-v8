const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    // Buscar especificamente logs relacionados ao contato 5923 nos últimos 10 minutos
    const logsQuery = `
      SELECT id, created_at, origem, mensagem, payload
      FROM app_logs
      WHERE created_at >= NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    const res = await client.query(logsQuery);
    console.log("=== LOGS ESPECÍFICOS DO ERRO ===");
    res.rows.forEach(row => {
      console.log(`[${row.created_at.toISOString()}] [${row.origem}] ${row.mensagem}`);
      if (row.payload) {
        console.log("Payload:", JSON.stringify(row.payload, null, 2));
      }
      console.log("-".repeat(80));
    });

  } catch(e) {
    console.error('Erro na execução:', e);
  } finally {
    await client.end();
  }
}

main();
