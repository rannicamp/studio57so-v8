require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fetchFeedbacks() {
  try {
    const password = process.env.SUPABASE_DB_PASSWORD;
    const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
    const projectId = baseHost.split('.')[0];
    const host = `db.${projectId}.supabase.co`;
    const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

    const client = new Client({ connectionString: connStr });
    await client.connect();
    
    // Tentativa de puxar dados. Vamos tentar relacionar, se falhar fazemos sem JOIN complexo.
    const result = await client.query(`
        SELECT f.*, 
               func.nome_display as autor_nome,
               org.razao_social as org_nome, org.nome_fantasia as org_fantasia
        FROM feedback f
        LEFT JOIN funcionarios func ON f.autor_id = func.user_id
        LEFT JOIN organizacoes o ON f.organizacao_id = o.id
        LEFT JOIN cadastro_empresa org ON o.entidade_principal_id = org.id
        WHERE f.status IN ('Novo', 'Em Análise') AND (f.diagnostico IS NULL OR f.diagnostico = '')
    `);
    
    console.log(JSON.stringify(result.rows, null, 2));
    await client.end();
  } catch (error) {
    console.error("ERRO:", error.message);
  }
}

fetchFeedbacks();
