const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log("Tabelas no schema public:");
    console.log(res.rows.map(r => r.table_name));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
