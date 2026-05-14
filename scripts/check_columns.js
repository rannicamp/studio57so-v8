const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
  const client = new Client({
    connectionString: decodeURIComponent(STUDIO_URL),
    ssl: SSL
  });

  try {
    await client.connect();
    
    // Check schemas
    const tables = ['colunas_funil', 'contatos_no_funil'];
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}';
      `);
      console.log(`\nTable ${table}:`);
      console.log(res.rows);
    }
  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await client.end();
  }
}
run();
