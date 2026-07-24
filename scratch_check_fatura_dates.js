const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  // select a few credit card transactions from Org 2
  const res = await client.query(`
    SELECT l.id, l.descricao, l.valor, l.data_vencimento, l.data_transacao, l.data_pagamento, c.nome as conta_nome
    FROM public.lancamentos l
    JOIN public.contas_financeiras c ON c.id = l.conta_id
    WHERE c.tipo = 'Cartão de Crédito' AND c.organizacao_id = 2
    ORDER BY l.data_transacao DESC
    LIMIT 20;
  `);
  
  console.log(JSON.stringify(res.rows, null, 2));
  
  await client.end();
}
run();
