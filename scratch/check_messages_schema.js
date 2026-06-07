const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'whatsapp_messages'
  `);
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
