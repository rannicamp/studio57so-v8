const { Client } = require('pg');

async function check() {
  const connStr = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     const res = await client.query(`
        SELECT proacl
        FROM pg_proc
        WHERE proname = 'fn_relatorio_comercial';
     `);
     console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
     console.error(e.message);
  } finally {
     await client.end();
  }
}
check();
