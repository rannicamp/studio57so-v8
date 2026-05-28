const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- POLÍTICAS DE RLS DA TABELA WHATSAPP_MESSAGES ---');

  const res = await client.query(`
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'whatsapp_messages';
  `);

  res.rows.forEach(r => {
    console.log(`\nPolítica: "${r.policyname}"`);
    console.log(`Comando: ${r.cmd}`);
    console.log(`Qual: ${r.qual}`);
    console.log(`With Check: ${r.with_check}`);
  });

  await client.end();
}

main().catch(console.error);
