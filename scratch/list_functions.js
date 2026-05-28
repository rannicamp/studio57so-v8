const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Consulta para listar funções com nome fn_relatorio_comercial e seus argumentos
    const query = `
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_catalog.pg_get_function_arguments(p.oid) as arguments
      FROM pg_catalog.pg_proc p
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'fn_relatorio_comercial';
    `;
    
    const res = await client.query(query);
    console.log("Definições de fn_relatorio_comercial encontradas no banco:");
    console.table(res.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
