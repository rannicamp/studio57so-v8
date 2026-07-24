const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  const clienteIds = ['5847', '6286', '6287'];
  const contratoId = '135';

  console.log("=== BUSCANDO NA TABELA contrato_parcelas ===");
  const contratoParcelasRes = await client.query(`
    SELECT id, contrato_id, descricao, valor_parcela, data_vencimento, status_pagamento, lancamento_id, created_at
    FROM public.contrato_parcelas
    WHERE contrato_id = $1
    ORDER BY data_vencimento, id
  `, [contratoId]);
  console.log(`Encontradas ${contratoParcelasRes.rows.length} parcelas no cronograma do contrato:`);
  console.log(contratoParcelasRes.rows);

  console.log("\n=== BUSCANDO LANÇAMENTOS POR CONTATO (VANDA) OU POR DESCRIÇÃO ===");
  const lancamentosRes = await client.query(`
    SELECT id, descricao, valor, data_vencimento, data_pagamento, 
           contrato_id, conta_id, tipo, favorecido_contato_id, created_at
    FROM public.lancamentos 
    WHERE favorecido_contato_id = ANY($1)
       OR descricao ILIKE '%Vanda%'
       OR descricao ILIKE '%403%'
    ORDER BY data_vencimento, created_at
  `, [clienteIds]);
  console.log(`Encontrados ${lancamentosRes.rows.length} lançamentos no financeiro:`);
  console.log(lancamentosRes.rows);

  await client.end();
}

run().catch(console.error);
