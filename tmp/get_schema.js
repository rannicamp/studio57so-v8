require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();

  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name IN ('contratos', 'produtos')
  `);
  
  const tables = {};
  res.rows.forEach(r => {
    if (!tables[r.table_name]) tables[r.table_name] = [];
    tables[r.table_name].push(r.column_name);
  });
  console.log(JSON.stringify(tables, null, 2));

  await client.end();
}
run();
