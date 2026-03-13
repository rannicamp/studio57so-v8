import pg from 'pg';
import fs from 'fs';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/20260313150000_get_quantitativos_orcamentacao_bim.sql', 'utf8');
  try {
    await client.query(sql);
    console.log('✅ RPC Atualizada com vinculo por Elemento!');
  } catch(e) {
    console.error('❌ Erro:', e);
  }
  await client.end();
}
run();
