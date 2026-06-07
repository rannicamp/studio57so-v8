const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== VERIFICANDO TIPOS DE PRODUTOS NO RESIDENCIAL ALFA ===");

  const resTipos = await client.query(`
    SELECT distinct tipo, count(*) 
    FROM public.produtos_empreendimento
    WHERE empreendimento_id = 1 AND organizacao_id = 2
    GROUP BY tipo
  `);
  console.log("Tipos de produtos no Residencial Alfa:");
  console.log(resTipos.rows);

  console.log("\n=== LISTANDO PRODUTOS DO TIPO VAGA CARRO ===");
  const resGaragens = await client.query(`
    SELECT id, unidade, tipo, status, valor_venda_calculado 
    FROM public.produtos_empreendimento
    WHERE empreendimento_id = 1 AND organizacao_id = 2 AND tipo = 'Vaga Carro'
    LIMIT 20
  `);
  console.log("Vagas de carro encontradas:");
  console.log(resGaragens.rows);

  await client.end();
}

run().catch(console.error);
