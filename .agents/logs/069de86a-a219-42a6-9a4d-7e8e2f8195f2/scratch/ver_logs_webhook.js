const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Últimos 20 logs na tabela whatsapp_webhook_logs ---');
  const res = await client.query(`
    SELECT id, log_level, message, payload, created_at
    FROM whatsapp_webhook_logs
    ORDER BY created_at DESC
    LIMIT 20;
  `);

  for (const row of res.rows) {
    console.log(`\nID: ${row.id} | Level: ${row.log_level} | Date: ${row.created_at}`);
    console.log(`Message: "${row.message}"`);
    console.log(`Payload:`, JSON.stringify(row.payload, null, 2));
  }

  await client.end();
}

main();
