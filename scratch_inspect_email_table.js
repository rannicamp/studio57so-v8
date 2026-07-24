// scratch_inspect_email_table.js
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runSQL() {
  const password = 'REMOVED_PASSWORD';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Conectando ao banco para inspecionar a tabela email_configuracoes...");
     await client.connect();
     
     console.log("\n1️⃣ Colunas da tabela email_configuracoes:");
     const columnsRes = await client.query(`
       SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_schema = 'public' 
         AND table_name = 'email_configuracoes'
     `);
     console.log(columnsRes.rows);

     console.log("\n2️⃣ Restrições (Constraints) de chaves e unicidade:");
     const constraintsRes = await client.query(`
       SELECT conname, pg_get_constraintdef(c.oid) as constraint_def
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE n.nspname = 'public' 
         AND t.relname = 'email_configuracoes'
     `);
     console.log(constraintsRes.rows);

     console.log("\n3️⃣ Triggers na tabela email_configuracoes:");
     const triggersRes = await client.query(`
       SELECT trigger_name, event_manipulation, action_statement
       FROM information_schema.triggers
       WHERE event_object_schema = 'public'
         AND event_object_table = 'email_configuracoes'
     `);
     console.log(triggersRes.rows);

  } catch(e) {
     console.error("FALHA NA QUERY SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
