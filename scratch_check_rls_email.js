// scratch_check_rls_email.js
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runSQL() {
  const password = 'Srbr19010720@';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Conectando ao banco para verificar políticas de RLS da tabela email_configuracoes...");
     await client.connect();
     
     console.log("\n1️⃣ Verificando se RLS está ativo:");
     const rlsRes = await client.query(`
       SELECT tablename, rowsecurity 
       FROM pg_tables 
       WHERE schemaname = 'public' AND tablename = 'email_configuracoes'
     `);
     console.log(rlsRes.rows);

     console.log("\n2️⃣ Políticas de RLS da tabela email_configuracoes:");
     const policiesRes = await client.query(`
       SELECT policyname, permissive, roles, cmd, qual, with_check 
       FROM pg_policies 
       WHERE tablename = 'email_configuracoes'
     `);
     console.log(policiesRes.rows);

  } catch(e) {
     console.error("FALHA:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
