const { Client } = require('pg');

async function run() {
  const connectionString = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    const resOrgs = await client.query(`
      SELECT id, nome, subdominio FROM public.sys_org;
    `);
    console.table(resOrgs.rows);

  } catch (error) {
    console.error('❌ Erro na consulta:', error);
  } finally {
    await client.end();
  }
}

run();
