require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();

  // Buscar feedbacks pendentes sem diagnóstico
  const { rows: feedbacks } = await client.query(`
    SELECT 
      f.id,
      f.titulo,
      f.descricao,
      f.pagina,
      f.tipo,
      f.status,
      f.prioridade,
      f.diagnostico,
      f.plano_solucao,
      f.created_at,
      f.usuario_id,
      f.organizacao_id
    FROM feedback f
    WHERE f.status IN ('Novo', 'Em Análise')
      AND (f.diagnostico IS NULL OR f.diagnostico = '')
    ORDER BY f.created_at ASC
  `);

  console.log('=== FEEDBACKS PENDENTES ===');
  console.log(JSON.stringify(feedbacks, null, 2));

  // Para cada feedback, buscar info do usuário e organização
  for (const fb of feedbacks) {
    if (fb.usuario_id) {
      // Tentar buscar nome nas tabelas de funcionários
      const { rows: funcs } = await client.query(`
        SELECT 
          fn.nome_completo,
          fn.email,
          ce.nome_fantasia,
          ce.razao_social
        FROM funcionarios fn
        LEFT JOIN cadastro_empresa ce ON ce.organizacao_id = fn.organizacao_id
        WHERE fn.user_id = $1
        LIMIT 1
      `, [fb.usuario_id]);

      if (funcs.length > 0) {
        fb.nome_usuario = funcs[0].nome_completo;
        fb.email_usuario = funcs[0].email;
        fb.nome_empresa = funcs[0].nome_fantasia || funcs[0].razao_social;
      }

      // Fallback: buscar no auth.users (metadata)
      if (!fb.nome_usuario) {
        const { rows: users } = await client.query(`
          SELECT 
            u.email,
            u.raw_user_meta_data->>'full_name' as full_name,
            u.raw_user_meta_data->>'name' as name
          FROM auth.users u
          WHERE u.id = $1
          LIMIT 1
        `, [fb.usuario_id]);

        if (users.length > 0) {
          fb.nome_usuario = users[0].full_name || users[0].name || users[0].email;
          fb.email_usuario = users[0].email;
        }
      }
    }

    if (fb.organizacao_id && !fb.nome_empresa) {
      const { rows: orgs } = await client.query(`
        SELECT nome_fantasia, razao_social FROM cadastro_empresa WHERE organizacao_id = $1 LIMIT 1
      `, [fb.organizacao_id]);
      if (orgs.length > 0) {
        fb.nome_empresa = orgs[0].nome_fantasia || orgs[0].razao_social;
      }
    }
  }

  console.log('=== FEEDBACKS ENRIQUECIDOS ===');
  console.log(JSON.stringify(feedbacks, null, 2));

  await client.end();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
