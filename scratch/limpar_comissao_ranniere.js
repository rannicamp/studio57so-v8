const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== LIMPANDO COMISSÃO MANUAL E EXECUTANDO TRIGGER ===");

  const contratoId = 121;
  const organizacaoId = 2;

  // 1. Fazer update forçando a trigger a recalcular (passando valor_comissao_corretagem = null)
  await client.query(`
    UPDATE public.contratos 
    SET 
      percentual_comissao_corretagem = 5.0,
      valor_comissao_corretagem = NULL
    WHERE id = $1 AND organizacao_id = $2
  `, [contratoId, organizacaoId]);

  console.log("[OK] Update executado definindo percentual como 5.0% e valor como NULL para acionar a trigger.");

  // 2. Buscar o contrato para ver o valor calculado pela trigger
  const res = await client.query(`
    SELECT id, valor_final_venda, percentual_comissao_corretagem, valor_comissao_corretagem
    FROM public.contratos
    WHERE id = $1 AND organizacao_id = $2
  `, [contratoId, organizacaoId]);

  const contrato = res.rows[0];
  console.log("\nDados pós-trigger:");
  console.log(`- Contrato ID: ${contrato.id}`);
  console.log(`- Valor de Venda: R$ ${contrato.valor_final_venda}`);
  console.log(`- % Comissão: ${contrato.percentual_comissao_corretagem}%`);
  console.log(`- Valor Comissão (Nativo do Banco): R$ ${contrato.valor_comissao_corretagem}`);

  await client.end();
}

run().catch(console.error);
