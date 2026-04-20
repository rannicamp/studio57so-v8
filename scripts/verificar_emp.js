require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const host = `db.${baseHost.split('.')[0]}.supabase.co`;
  const client = new Client({ connectionString: `postgres://postgres:${password}@${host}:6543/postgres` });
  
  await client.connect();
  const res = await client.query(`SELECT id, nome, orcamento_previsto, orcamento_executado, orcamento_percentual FROM public.empreendimentos WHERE orcamento_previsto > 0 LIMIT 1;`);
  console.log(res.rows);
  await client.end();
}
runSQL();
