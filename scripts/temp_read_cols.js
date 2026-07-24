const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('contatos_no_funil', 'usuarios') 
      AND column_name IN ('corretor_id', 'contato_id', 'id');
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();
