require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) { console.log('Sem senha no env local. Cancelando.'); return; }
  
  // Extrai o host corretamente (ex: vhuvnutzklhskkwbpxdz.supabase.co)
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  console.log('Conectando em:', host);

  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     console.log("Conectado ao DB. Injetando coluna 'status' na tabela feedback...");
     await client.query(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Novo';`);
     console.log("Sucesso: Coluna 'status' injetada com sucesso parar o CRM de ideias!");
  } catch(e) {
     console.log("ERRO SQL:", e.message);
  } finally {
     await client.end();
  }
}
run();
