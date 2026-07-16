// scratch_check_rls_instagram.js
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
     console.log("Conectando ao Supabase para auditar RLS...");
     await client.connect();
     
     console.log("\n1️⃣ Verificando se RLS está habilitado para as tabelas:");
     const resRLS = await client.query(`
       SELECT tablename, rowsecurity 
       FROM pg_tables 
       WHERE schemaname = 'public' 
         AND tablename IN ('instagram_conversations', 'instagram_messages')
     `);
     console.log(resRLS.rows);

     console.log("\n2️⃣ Verificando políticas de segurança ativas para essas tabelas:");
     const resPolicies = await client.query(`
       SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
       FROM pg_policies 
       WHERE schemaname = 'public' 
         AND tablename IN ('instagram_conversations', 'instagram_messages')
     `);
     console.log(resPolicies.rows);

     console.log("\nOperação concluída!");
  } catch(e) {
     console.error("FALHA:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
