const { Client } = require('pg');

async function main() {
  console.log("=== BUSCANDO HISTÓRICO DE LOGS DA SARAH (ID 5976) VIA PG ===");

  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    const query = `
      SELECT *
      FROM app_logs
      WHERE (mensagem ILIKE '%5976%' OR payload::text ILIKE '%5976%')
      ORDER BY created_at ASC;
    `;
    const res = await client.query(query);
    const logs = res.rows;

    console.log(`Encontrados ${logs.length} logs para a Sarah.`);
    logs.forEach(log => {
      const localTime = new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      console.log(`\n[${localTime}] ID: ${log.id}`);
      console.log(`Mensagem: "${log.mensagem}"`);
      if (log.payload) {
        console.log(`Payload:`, JSON.stringify(log.payload, null, 2));
      }
      console.log("-".repeat(60));
    });
  } catch (err) {
    console.error("Erro ao buscar logs:", err.message);
  } finally {
    await client.end();
  }
}

main();
