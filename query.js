const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  console.log("--- PEDIDOS COM FASE NULA OU ERRO DE STRING ---");
  let res = await client.query("SELECT id, titulo, status, fase_id, organizacao_id FROM public.pedidos_compra WHERE fase_id IS NULL");
  console.log(res.rows);

  console.log("--- FASES CADASTRADAS POR ORG ---");
  res = await client.query("SELECT organizacao_id, count(*) as count FROM public.pedidos_fases GROUP BY organizacao_id");
  console.log(res.rows);

  await client.end();
}

run();
