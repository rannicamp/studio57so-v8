const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Últimas 20 Mensagens do Ranniere (5598) ---');
  const res = await client.query(`
    SELECT id, message_id, content, direction, status, error_message, sent_at, created_at
    FROM whatsapp_messages
    WHERE contato_id = 5598
    ORDER BY created_at DESC
    LIMIT 20;
  `);

  for (const row of res.rows) {
    console.log(`\nID: ${row.id} | Direction: ${row.direction} | Status: ${row.status}`);
    console.log(`Sent At: ${row.sent_at} | Created At: ${row.created_at}`);
    console.log(`Content: "${row.content}"`);
    if (row.error_message) {
      console.log(`Error: ${row.error_message}`);
    }
  }

  await client.end();
}

main();
