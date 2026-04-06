require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function checkRPC() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT prosrc
      FROM pg_proc 
      WHERE proname = 'unificar_materiais'
    `);
    fs.writeFileSync('tmp_rpc.txt', res.rows[0]?.prosrc || 'not found');
    console.log('OK');
  } catch(e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
checkRPC();
