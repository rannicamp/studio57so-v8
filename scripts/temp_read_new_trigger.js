const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT trigger_name, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE action_statement LIKE '%processar_notificacao_automatica%';
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();
