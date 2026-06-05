const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Produtos do Empreendimento 5 (Beta Suítes) ---');
  const res = await client.query(`
    SELECT id, unidade, status, organizacao_id, valor_venda_calculado
    FROM produtos_empreendimento
    WHERE empreendimento_id = 5
    LIMIT 30;
  `);
  console.table(res.rows);

  console.log('--- Contagem por organizacao_id no Empreendimento 5 ---');
  const countRes = await client.query(`
    SELECT organizacao_id, status, count(*)
    FROM produtos_empreendimento
    WHERE empreendimento_id = 5
    GROUP BY organizacao_id, status;
  `);
  console.table(countRes.rows);

  await client.end();
}

main();
