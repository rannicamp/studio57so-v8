const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- DETALHES DA MENSAGEM 19049 ---');

  const res = await client.query(`
    SELECT *
    FROM whatsapp_messages
    WHERE id = 19049;
  `);

  console.log(res.rows[0]);

  await client.end();
}

main().catch(console.error);
