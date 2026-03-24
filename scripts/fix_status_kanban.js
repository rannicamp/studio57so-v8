require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fixStatus() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || 'Srbr19010720@';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     // Set status to 'Implementado' which is what FeedbackKanban.js expects for ALL closed tickets
     await client.query("UPDATE feedback SET status = 'Implementado' WHERE status IN ('Concluído', 'Resolvido') OR status ILIKE '%concluí%' OR status ILIKE '%resolvi%'");
     console.log("Status de todos os tickets processados corrigidos para 'Implementado'!");
  } catch(e) {
     console.error(e.message);
  } finally {
     await client.end();
  }
}
fixStatus();
