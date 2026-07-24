require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fetchTriagem() {
  const STUDIO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
  const SSL = { rejectUnauthorized: false };
  const client = new Client({
    connectionString: decodeURIComponent(STUDIO_URL),
    ssl: SSL
  });
  try {
    await client.connect();
    // Also fetch user name
    const { rows } = await client.query(`
      SELECT f.*, u.nome as autor_nome 
      FROM feedback f
      LEFT JOIN usuarios u ON f.usuario_id = u.id
      WHERE (f.status = 'Novo' OR f.status = 'Em Análise') 
        AND (f.diagnostico IS NULL OR f.diagnostico = '')
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error fetching triagem:', err);
  } finally {
    await client.end();
  }
}

fetchTriagem();
