const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Buscando colunas da tabela empreendimento_anexos...');
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'empreendimento_anexos';
  `);

  console.table(res.rows);

  await client.end();
}

main();
