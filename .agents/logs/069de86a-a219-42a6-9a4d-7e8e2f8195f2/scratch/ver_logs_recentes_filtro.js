const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Buscando logs de webhook no horário da mensagem ---');
  const res = await client.query(`
    SELECT id, log_level, message, payload, created_at
    FROM whatsapp_webhook_logs
    WHERE created_at >= '2026-06-05 13:24:00-03' AND created_at <= '2026-06-05 13:28:00-03'
    ORDER BY created_at ASC;
  `);

  console.log(`Encontrados ${res.rows.length} logs.`);
  for (const row of res.rows) {
    console.log(`\nID: ${row.id} | Level: ${row.log_level} | Date: ${row.created_at}`);
    console.log(`Message: "${row.message}"`);
    console.log(`Payload:`, JSON.stringify(row.payload, null, 2));
  }

  await client.end();
}

main();
