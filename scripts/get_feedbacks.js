require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT f.*,
             (SELECT p.nome FROM funcionarios p WHERE p.user_id = f.usuario_id LIMIT 1) as user_nome,
             (SELECT c.nome_fantasia FROM cadastro_empresa c WHERE c.organizacao_id = f.organizacao_id LIMIT 1) as org_nome
      FROM feedback f
      WHERE f.status IN ('Novo', 'Em Análise') 
      AND (f.diagnostico IS NULL OR f.diagnostico = '')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    if (err.message.includes('usuario_id')) {
        const res2 = await client.query(`
          SELECT f.*,
                 (SELECT p.nome FROM funcionarios p WHERE p.user_id = f.created_by LIMIT 1) as user_nome,
                 (SELECT c.nome_fantasia FROM cadastro_empresa c WHERE c.organizacao_id = f.organizacao_id LIMIT 1) as org_nome
          FROM feedback f
          WHERE f.status IN ('Novo', 'Em Análise') 
          AND (f.diagnostico IS NULL OR f.diagnostico = '')
        `);
        console.log(JSON.stringify(res2.rows, null, 2));
    } else {
        console.error("SQL Error: ", err.message);
        const resTables = await client.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback'
        `);
        console.log("Feedback columns: ", JSON.stringify(resTables.rows, null, 2));
    }
  }
  await client.end();
}
run().catch(console.error);
