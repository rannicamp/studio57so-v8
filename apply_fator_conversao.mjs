import pg from 'pg';
import fs from 'fs';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const sql = fs.readFileSync('supabase/migrations/20260313161000_add_fator_conversao.sql', 'utf8');
    await client.query(sql);
    console.log('Migration fator_conversao aplicada com sucesso.');
  } catch (err) {
    console.error('Erro na migration:', err);
  }
  await client.end();
}
run();
