const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- BUSCANDO DADOS DO USUÁRIO RANNIERE ---');

  const res = await client.query(`
    SELECT id, nome, email, organizacao_id
    FROM usuarios
    WHERE nome ILIKE '%ranniere%' OR email ILIKE '%ranni%';
  `);

  console.log(res.rows);

  await client.end();
}

main().catch(console.error);
