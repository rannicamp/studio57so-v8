const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Listando tabelas do banco...');
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%attachment%';
  `);

  console.log('Tabelas encontradas:', res.rows);

  // Vamos listar TODAS as tabelas do schema public para termos certeza
  const resAll = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('Todas as tabelas:', resAll.rows.map(r => r.table_name).join(', '));

  await client.end();
}

main();
