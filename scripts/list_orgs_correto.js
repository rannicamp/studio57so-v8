const { Client } = require('pg');

async function run() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    const resOrgs = await client.query(`
      SELECT id, nome FROM public.organizacoes;
    `);
    console.table(resOrgs.rows);

  } catch (error) {
    console.error('❌ Erro na consulta:', error);
  } finally {
    await client.end();
  }
}

run();
