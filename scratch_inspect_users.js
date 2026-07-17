const { Client } = require('pg');
const connStr = 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log("Buscando perfis na tabela usuarios...");
    const users = await client.query(`
      SELECT id, email, nome, organizacao_id, is_superadmin, is_active
      FROM public.usuarios 
      WHERE email LIKE 'rannierecampos%';
    `);
    console.log(users.rows);

  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    await client.end();
  }
}

run();
