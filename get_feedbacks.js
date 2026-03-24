require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function getFeedbacks() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    const res = await client.query(
        "SELECT id, descricao, pagina, status FROM feedback WHERE status IN ('Novo', 'Em Análise') AND (diagnostico IS NULL OR diagnostico = '')"
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

getFeedbacks();
