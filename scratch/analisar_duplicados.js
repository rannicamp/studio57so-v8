const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const contatoId = '6287'; // Vanda Maria Perine
  const contratoId = '135';

  console.log("=== PARCELAS NO CRONOGRAMA (contrato_parcelas) ===");
  const parcelas = await client.query(`
    SELECT id, descricao, valor_parcela, data_vencimento, status_pagamento, lancamento_id, created_at
    FROM public.contrato_parcelas
    WHERE contrato_id = $1
    ORDER BY id
  `, [contratoId]);

  console.log(`Total no cronograma: ${parcelas.rows.length}`);
  parcelas.rows.forEach(p => {
    console.log(`ID: ${p.id} | Desc: "${p.descricao}" | Valor: ${p.valor_parcela} | Venc: ${p.data_vencimento.toISOString().substring(0,10)} | LancID: ${p.lancamento_id} | Criado: ${p.created_at.toISOString()}`);
  });

  console.log("\n=== LANÇAMENTOS NO FINANCEIRO (lancamentos) ===");
  const lancamentos = await client.query(`
    SELECT id, descricao, valor, data_vencimento, contrato_id, favorecido_contato_id, created_at, origem_criacao
    FROM public.lancamentos
    WHERE favorecido_contato_id = $1 OR descricao ILIKE '%Vanda%'
    ORDER BY created_at, id
  `, [contatoId]);

  console.log(`Total no financeiro: ${lancamentos.rows.length}`);
  lancamentos.rows.forEach(l => {
    console.log(`ID: ${l.id} | Desc: "${l.descricao}" | Valor: ${l.valor} | Venc: ${l.data_vencimento ? l.data_vencimento.toISOString().substring(0,10) : 'N/A'} | ContratoID: ${l.contrato_id} | Origem: ${l.origem_criacao} | Criado: ${l.created_at.toISOString()}`);
  });

  await client.end();
}

run().catch(console.error);
