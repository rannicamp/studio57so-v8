const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Dados de Cadastro do Ranniere (ID: 5598) ---');
  const res = await client.query(`
    SELECT id, nome, cpf, rg, nacionalidade, estado_civil, birth_date, ia_atendimento_ativo, cep, address_street, address_number, address_complement, neighborhood, city, state 
    FROM contatos 
    WHERE id = 5598;
  `);
  console.log(JSON.stringify(res.rows[0], null, 2));

  await client.end();
}

main();
