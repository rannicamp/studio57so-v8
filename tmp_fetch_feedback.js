require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function getFeedbacks() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT f.id, f.titulo, f.descricao, f.pagina, f.status, f.prioridade, f.anexo_url, 
             f.user_id, f.organizacao_id,
             func.full_name as funcionario_nome,
             emp.razao_social as organizacao_nome
      FROM feedback f
      LEFT JOIN auth.users u ON f.user_id = u.id
      LEFT JOIN public.funcionarios func ON u.id = func.user_id
      LEFT JOIN public.cadastro_empresa emp ON f.organizacao_id = emp.id
      WHERE f.status IN ('Novo', 'Em Análise') 
        AND (f.diagnostico IS NULL OR f.diagnostico = '')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
  } finally {
    await client.end();
  }
}

getFeedbacks();
