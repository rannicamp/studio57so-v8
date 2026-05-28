const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- INSPEÇÃO DE WHATSAPP_CONVERSATIONS PARA ADIRSON (5199) ---');

  const res = await client.query(`
    SELECT *
    FROM whatsapp_conversations
    WHERE contato_id = 5199 OR phone_number LIKE '%3384051443%';
  `);

  console.log(res.rows);

  await client.end();
}

main().catch(console.error);
