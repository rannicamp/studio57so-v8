const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const STUDIO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function run() {
  const client = new Client({
    connectionString: decodeURIComponent(STUDIO_URL),
    ssl: SSL
  });

  try {
    await client.connect();
    
    // Find CRM tables
    const crmTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%crm%' OR table_name LIKE '%automacao%' OR table_name LIKE '%funil%');
    `);
    
    console.log("Found tables:", crmTables.rows);

  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await client.end();
  }
}
run();
