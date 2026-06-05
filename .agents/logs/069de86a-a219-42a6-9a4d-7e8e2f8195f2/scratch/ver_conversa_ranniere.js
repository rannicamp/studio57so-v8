const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Colunas de configuracoes_whatsapp ---');
  const resCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'configuracoes_whatsapp'
    ORDER BY ordinal_position;
  `);
  console.table(resCols.rows);

  console.log('--- Linhas de configuracoes_whatsapp ---');
  const resRows = await client.query(`SELECT * FROM configuracoes_whatsapp;`);
  console.log(JSON.stringify(resRows.rows, null, 2));

  await client.end();
}

main();
