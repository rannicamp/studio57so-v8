import pg from 'pg';

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query(`
      SELECT 
        p.proname,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_function_result(p.oid) as result
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'get_quantitativos_orcamentacao_bim';
    `);
    
    console.log('Assinaturas da RPC encontradas no banco:');
    console.log(JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error('Erro ao buscar db:', err);
  }
  await client.end();
}
run();
