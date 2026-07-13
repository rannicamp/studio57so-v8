const { Client } = require('pg');

const PG_CONN = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

async function run() {
  const pgClient = new Client({
    connectionString: PG_CONN,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  
  const res = await pgClient.query(`
    SELECT * FROM public.lancamentos LIMIT 1;
  `);
  
  console.log("=== LANÇAMENTO SCHEMA ROW ===");
  console.log(Object.keys(res.rows[0]));
  console.log(res.rows[0]);
  
  await pgClient.end();
}

run().catch(err => {
  console.error("Erro:", err);
});
