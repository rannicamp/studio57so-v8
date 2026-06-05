const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Contagem Geral de Produtos por Empreendimento, Status e Org ---');
  const res = await client.query(`
    SELECT empreendimento_id, status, organizacao_id, count(*)
    FROM produtos_empreendimento
    WHERE empreendimento_id IN (1, 5, 6)
    GROUP BY empreendimento_id, status, organizacao_id
    ORDER BY empreendimento_id, status, organizacao_id;
  `);
  console.table(res.rows);

  await client.end();
}

main();
