const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Colunas de contatos ---');
  const cols = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'contatos';
  `);
  console.log(cols.rows.map(r => r.column_name).join(', '));

  console.log('--- Buscando contatos por nome ---');
  const res = await client.query(`
    SELECT *
    FROM contatos 
    WHERE nome ILIKE '%ranniere%';
  `);
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

main();
