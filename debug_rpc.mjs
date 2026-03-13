import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`SELECT * FROM get_quantitativos_orcamentacao_bim(1, null)`);
    console.log(res.rows);
  } catch (err) {
    console.error('Erro ao buscar db:', err);
  }
  await client.end();
}
run();
