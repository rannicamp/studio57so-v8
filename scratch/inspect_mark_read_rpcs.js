const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- DEFINIÇÕES DAS RPCS DE LEITURA ---');

  const res = await client.query(`
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_name IN ('mark_whatsapp_messages_read_multi', 'reset_whatsapp_unreads') AND routine_schema = 'public';
  `);

  res.rows.forEach(r => {
    console.log(`\nFunção: ${r.routine_name}`);
    console.log(r.routine_definition);
  });

  await client.end();
}

main().catch(console.error);
