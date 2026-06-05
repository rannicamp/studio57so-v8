const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Buscando telefones do contato Ranniere (5598) ---');
  const resPhone = await client.query(`
    SELECT telefone, tipo
    FROM telefones
    WHERE contato_id = 5598;
  `);
  console.table(resPhone.rows);

  await client.end();
}

main();
