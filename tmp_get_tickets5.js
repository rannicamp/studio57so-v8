require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function getNewTickets() {
  const password = process.env.SUPABASE_DB_PASSWORD;
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
    const res = await client.query(`
      SELECT f.id, f.pagina, f.descricao, f.imagem_url, f.status, 
             u.raw_user_meta_data->>'nome' as autor_nome
      FROM feedback f
      LEFT JOIN auth.users u ON f.usuario_id = u.id
      WHERE (f.status = 'Novo' OR f.status = 'Em Análise') 
        AND f.diagnostico IS NULL
    `);
    fs.writeFileSync('tmp_tickets.json', JSON.stringify(res.rows, null, 2));
  } catch(e) {
    fs.writeFileSync('tmp_tickets.json', JSON.stringify({error: e.message}));
  } finally {
    await client.end();
  }
}
getNewTickets();
