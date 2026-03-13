import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const sql = fs.readFileSync('supabase/migrations/20260313150000_get_quantitativos_orcamentacao_bim.sql', 'utf8');
    await client.query(sql);
    console.log('RPC get_quantitativos_orcamentacao_bim Atualizada com SUCESSO');
  } catch (err) {
    console.error('Erro na migration:', err);
  }
  await client.end();
}
run();
