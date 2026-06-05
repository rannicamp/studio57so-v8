const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Registro Completo de Refúgio Braúnas (ID 6) ---');
  const resEmp = await client.query(`
    SELECT * FROM empreendimentos WHERE id = 6;
  `);
  console.log(JSON.stringify(resEmp.rows[0], null, 2));

  console.log('\n--- Exemplo de 5 Produtos do Refúgio Braúnas (ID 6) ---');
  const resProd = await client.query(`
    SELECT id, unidade, valor_venda_calculado, status, descricao 
    FROM produtos_empreendimento 
    WHERE empreendimento_id = 6 AND status = 'Disponível'
    LIMIT 5;
  `);
  console.table(resProd.rows);

  await client.end();
}

main();
