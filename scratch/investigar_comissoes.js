const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== INVESTIGANDO COMISSÕES DE CONTRATOS EXISTENTES ===");

  // 1. Outros contratos e suas comissões
  const resContratos = await client.query(`
    SELECT id, valor_final_venda, percentual_comissao_corretagem, valor_comissao_corretagem, forma_pagamento_corretagem
    FROM public.contratos
    WHERE percentual_comissao_corretagem IS NOT NULL AND percentual_comissao_corretagem <> 0
    LIMIT 10
  `);

  console.log("Exemplos de contratos com comissão:");
  console.log(resContratos.rows);

  // 2. Procurar por triggers ou functions relacionadas a comissao_corretagem
  console.log("\n=== BUSCANDO TRIGGERS OU FUNÇÕES DE COMISSÃO ===");
  const resTriggers = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_name ILIKE '%comissao%' OR trigger_name ILIKE '%corretagem%' OR event_object_table = 'contratos'
  `);
  console.log("Triggers na tabela contratos ou com nome comissão:");
  console.log(resTriggers.rows);

  // 3. Ver definição de triggers da tabela contratos
  const resTrigDetails = await client.query(`
    SELECT r.routinename, r.routine_definition 
    FROM (
      SELECT regexp_matches(action_statement, '(\\w+)\\(\\)', 'g') as name, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'contratos'
    ) t
    JOIN (
      SELECT routine_name as routinename, routine_definition 
      FROM information_schema.routines
      WHERE routine_schema = 'public'
    ) r ON r.routinename = t.name[1]
  `);
  console.log("\nFunções de triggers associadas a contratos:");
  resTrigDetails.rows.forEach(row => {
    console.log(`- Função: ${row.routinename}`);
    console.log(row.routine_definition.substring(0, 500) + "...\n");
  });

  await client.end();
}

run().catch(console.error);
