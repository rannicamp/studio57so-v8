const { Client } = require('pg');

async function run() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    const resCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'indices_governamentais';
    `);
    console.table(resCols.rows);

  } catch (error) {
    console.error('❌ Erro na consulta:', error);
  } finally {
    await client.end();
  }
}

run();
