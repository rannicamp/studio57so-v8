require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD || 'REMOVED_PASSWORD';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco Postgres via porta 6543!');
    
    const query = `
      SELECT f.*, 
             u.nome as usuario_nome, 
             u.sobrenome as usuario_sobrenome,
             u.email as usuario_email,
             o.nome as organizacao_nome
      FROM feedback f
      LEFT JOIN usuarios u ON f.usuario_id = u.id
      LEFT JOIN organizacoes o ON f.organizacao_id = o.id
      WHERE (f.status = 'Novo' OR f.status = 'Em Análise')
        AND (f.diagnostico IS NULL OR f.diagnostico = '')
      ORDER BY f.created_at DESC;
    `;
    
    const res = await client.query(query);
    console.log(`📦 Encontrados ${res.rows.length} tickets pendentes para triagem.`);
    console.log(JSON.stringify(res.rows, null, 2));
    
  } catch (error) {
    console.error('❌ Erro na consulta de feedbacks:', error);
  } finally {
    await client.end();
  }
}

main();
