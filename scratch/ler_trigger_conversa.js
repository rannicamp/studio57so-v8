const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT routine_definition 
    FROM information_schema.routines 
    WHERE routine_name = 'handle_new_message_update_conversation'
  `);

  if (res.rows.length > 0) {
    console.log("=== CÓDIGO DA FUNÇÃO DE TRIGGER ===");
    console.log(res.rows[0].routine_definition);
  } else {
    console.log("Função não encontrada.");
  }

  await client.end();
}

run().catch(console.error);
