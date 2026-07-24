const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    SELECT proname, pg_get_function_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'fn_relatorio_comercial';
  `;

  try {
      const res = await client.query(query);
      console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();
