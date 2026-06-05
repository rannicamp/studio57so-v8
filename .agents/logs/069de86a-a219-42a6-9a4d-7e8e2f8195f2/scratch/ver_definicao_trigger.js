const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Código-fonte da função handle_new_message_update_conversation ---');
  const res = await client.query(`
    SELECT prosrc 
    FROM pg_proc 
    WHERE proname = 'handle_new_message_update_conversation';
  `);
  console.log(res.rows[0]?.prosrc);

  await client.end();
}

main();
