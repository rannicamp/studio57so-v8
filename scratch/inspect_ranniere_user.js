const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- USUÁRIOS NA TABELA USUARIOS ---');

  const res = await client.query(`
    SELECT id, nome, email, organizacao_id
    FROM public.usuarios
    ORDER BY nome;
  `);

  res.rows.forEach(r => {
    console.log(`User: ${r.nome} | Email: ${r.email} | ID: ${r.id} | Org: ${r.organizacao_id}`);
  });

  await client.end();
}

main().catch(console.error);
