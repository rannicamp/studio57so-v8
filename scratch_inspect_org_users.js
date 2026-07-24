const { Client } = require('pg');
const connStr = 'postgres://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    
    console.log("=== USUÁRIOS DA ORG 28 ===");
    const users28 = await client.query(`
      SELECT id, email, nome, organizacao_id, is_superadmin
      FROM public.usuarios 
      WHERE organizacao_id = 28;
    `);
    console.log(users28.rows);

    console.log("=== USUÁRIOS DA ORG 47 ===");
    const users47 = await client.query(`
      SELECT id, email, nome, organizacao_id, is_superadmin
      FROM public.usuarios 
      WHERE organizacao_id = 47;
    `);
    console.log(users47.rows);

    console.log("=== EMPREENDIMENTOS DA ORG 47 ===");
    const emps47 = await client.query(`
      SELECT id, nome, organizacao_id
      FROM public.empreendimentos 
      WHERE organizacao_id = 47;
    `);
    console.log(emps47.rows);

    console.log("=== EMPREENDIMENTOS DA ORG 28 ===");
    const emps28 = await client.query(`
      SELECT id, nome, organizacao_id
      FROM public.empreendimentos 
      WHERE organizacao_id = 28;
    `);
    console.log(emps28.rows);

  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    await client.end();
  }
}

run();
