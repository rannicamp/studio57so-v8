require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fetchFeedbacks() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    
    const query = `
      SELECT f.*, 
             fn.nome as funcionario_nome,
             u.raw_user_meta_data->>'name' as author_name_meta,
             u.email as author_email,
             o.razao_social as org_name
      FROM public.feedback f
      LEFT JOIN auth.users u ON f.usuario_id = u.id
      LEFT JOIN public.funcionarios fn ON f.usuario_id = fn.auth_user_id
      LEFT JOIN public.organizacoes o ON f.organizacao_id = o.id
      WHERE (f.status = 'Novo' OR f.status = 'Em Análise')
        AND (f.diagnostico IS NULL OR f.diagnostico = '')
    `;
    
    const result = await client.query(query);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error("Erro:", e);
  } finally {
    await client.end();
  }
}

fetchFeedbacks();
