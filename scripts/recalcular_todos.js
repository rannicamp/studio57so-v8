require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     
     // Recalcula pra todo mundo já existente
     await client.query(`
       DO $$ 
       DECLARE
         r RECORD;
       BEGIN
         FOR r IN SELECT DISTINCT empreendimento_id FROM public.orcamentos WHERE empreendimento_id IS NOT NULL LOOP
           PERFORM public.fn_autocalcular_orcamento_empreendimento(r.empreendimento_id);
         END LOOP;
       END $$;
     `);
     
     console.log("Recálculo Global Retroativo completo!");
  } catch(e) {
     console.error("FALHA:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
