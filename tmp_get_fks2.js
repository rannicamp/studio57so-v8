require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function getFKs() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `aws-0-sa-east-1.pooler.supabase.com`;
  const connStr = `postgres://postgres.${projectId}:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT tc.table_name, kcu.column_name 
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name='lancamentos'
    `);
    console.log("REFERENCES TO lancamentos:");
    console.table(res.rows);
    
    const res2 = await client.query(`
      SELECT tc.table_name, kcu.column_name 
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name='materiais'
    `);
    console.log("REFERENCES TO materiais:");
    console.table(res2.rows);

  } catch(e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
getFKs();
