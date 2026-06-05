const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Mídias Recebidas do Ranniere (5598) ---');
  const res = await client.query(`
    SELECT id, media_url, content, created_at, raw_payload
    FROM whatsapp_messages
    WHERE contato_id = 5598 AND direction = 'inbound' AND media_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  
  for (const row of res.rows) {
    console.log(`\nID: ${row.id} | Data: ${row.created_at}`);
    console.log(`URL: ${row.media_url}`);
    console.log(`Content: ${row.content}`);
    console.log(`Payload Type: ${row.raw_payload?.type || 'N/A'}`);
  }

  await client.end();
}

main();
