const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Unidades Habitacionais Disponíveis do Empreendimento 5 (Beta Suítes) ---');
  const res = await client.query(`
    SELECT id, unidade, status, valor_venda_calculado, descricao
    FROM produtos_empreendimento
    WHERE empreendimento_id = 5 
      AND status = 'Disponível'
      AND unidade NOT LIKE 'MOTO%'
      AND unidade NOT LIKE 'CARRO%'
      AND unidade NOT LIKE 'GARAGEM%'
    ORDER BY unidade DESC;
  `);
  console.table(res.rows);

  await client.end();
}

main();
