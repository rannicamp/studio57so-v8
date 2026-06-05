const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Dossiê do Empreendimento 1 (Residencial Alfa) ---');
  const res = await client.query(`
    SELECT id, nome, dossie_ia
    FROM empreendimentos
    WHERE id = 1;
  `);
  console.log(res.rows[0].dossie_ia);

  await client.end();
}

main();
