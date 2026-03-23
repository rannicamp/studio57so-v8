require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) { console.log('Sem senha no env local. Cancelando.'); return; }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Conectando igualzinho antes...");
     await client.connect();
     console.log("Conectado! Injetando colunas 'diagnostico' e 'plano_solucao'...");
     await client.query(`
        ALTER TABLE feedback 
        ADD COLUMN IF NOT EXISTS diagnostico TEXT,
        ADD COLUMN IF NOT EXISTS plano_solucao TEXT;
     `);
     console.log("Sucesso Absoluto: Colunas adicionadas!");
  } catch(e) {
     console.log("ERRO SQL:", e.message);
  } finally {
     await client.end();
  }
}
run();
