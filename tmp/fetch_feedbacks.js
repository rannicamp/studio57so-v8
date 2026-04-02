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
  
  const query = `
    SELECT f.id, f.titulo, f.descricao, f.pagina, f.screenshot_url, f.status, f.diagnostico, f.criado_em,
           f.criado_por_usuario_id,
           u.raw_user_meta_data->>'name' as user_name,
           u.email as user_email
    FROM feedback f
    LEFT JOIN auth.users u ON f.criado_por_usuario_id = u.id
    WHERE f.status = 'Novo' AND (f.diagnostico IS NULL OR f.diagnostico = '')
  `;
  
  const res = await client.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  
  await client.end();
}
run().catch(console.error);
