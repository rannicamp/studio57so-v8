const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== BUSCANDO ASSINATURAS DAS RPCs NO POSTGRES ===");
  const res = await client.query(`
    SELECT 
      p.proname AS nome_funcao,
      pg_catalog.pg_get_function_arguments(p.oid) AS argumentos,
      t.typname AS tipo_retorno
    FROM pg_catalog.pg_proc p
    LEFT JOIN pg_catalog.pg_type t ON p.prorettype = t.oid
    LEFT JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname IN ('provisionar_parcelas_contrato', 'sincronizar_parcela_com_lancamento')
  `);
  console.log(res.rows);

  await client.end();
}

run().catch(console.error);
