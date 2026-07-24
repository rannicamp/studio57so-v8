const { Client } = require('pg');
const connStr = 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log("Conectado ao Postgres. Buscando políticas de RLS para a tabela activities...");
    
    const policies = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'activities';
    `);
    
    console.log("--- POLÍTICAS RLS ---");
    console.log(JSON.stringify(policies.rows, null, 2));

  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    await client.end();
  }
}

run();
