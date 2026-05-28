const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- ASSINATURAS DAS RPCS ---');

  const res = await client.query(`
    SELECT routine_name, p.data_type, p.parameter_name, p.parameter_mode
    FROM information_schema.routines r
    JOIN information_schema.parameters p ON r.specific_name = p.specific_name
    WHERE routine_name IN ('mark_whatsapp_messages_read_multi', 'reset_whatsapp_unreads') AND routine_schema = 'public'
    ORDER BY routine_name, p.ordinal_position;
  `);

  console.log(res.rows);

  await client.end();
}

main().catch(console.error);
