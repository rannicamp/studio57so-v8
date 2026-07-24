const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'processar_regras_notificacao';
  `);
  console.log(res.rows[0].pg_get_functiondef);
  await client.end();
}
run();
