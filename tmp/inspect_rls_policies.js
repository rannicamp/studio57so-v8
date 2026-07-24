const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- POLÍTICAS DE RLS DA TABELA WHATSAPP_MESSAGES ---');

  const res = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'whatsapp_messages';
  `);

  res.rows.forEach(r => {
    console.log(`\nPolítica: "${r.policyname}"`);
    console.log(`Permissive: ${r.permissive} | Comando: ${r.cmd}`);
    console.log(`Roles: ${r.roles.join(', ')}`);
    console.log(`Qual: ${r.qual}`);
    console.log(`With Check: ${r.with_check}`);
  });

  await client.end();
}

main();
