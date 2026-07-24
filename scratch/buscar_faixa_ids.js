const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== BUSCANDO LANÇAMENTOS POR ID SEQUENCIAL (20567 até 20608) ===");
  const res = await client.query(`
    SELECT id, descricao, valor, data_vencimento, contrato_id, favorecido_contato_id, created_at, conta_id
    FROM public.lancamentos
    WHERE id BETWEEN 20567 AND 20608
    ORDER BY id
  `);
  console.log(`Retornados ${res.rows.length} lançamentos de 42 possíveis:`);
  res.rows.forEach(r => {
    console.log(`ID: ${r.id} | Desc: "${r.descricao}" | Valor: ${r.valor} | Venc: ${r.data_vencimento ? r.data_vencimento.toISOString().substring(0,10) : 'N/A'} | ContatoID: ${r.favorecido_contato_id} | ContratoID: ${r.contrato_id}`);
  });

  await client.end();
}

run().catch(console.error);
