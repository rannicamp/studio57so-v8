require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     const res1 = await client.query(`
        SELECT count(*) 
        FROM public.contatos 
        WHERE created_at >= '2026-05-11 00:00:00'
     `);
     console.log("Total de contatos criados hoje (11/05/2026):", res1.rows[0].count);

     const res2 = await client.query(`
        SELECT count(*) 
        FROM public.contatos 
        WHERE created_at >= '2026-05-11 00:00:00' 
        AND (tipo = 'Lead' OR tipo = 'lead' OR tipo ILIKE '%lead%')
     `);
     console.log("Total de contatos criados hoje com tipo 'Lead':", res2.rows[0].count);

     const res3 = await client.query(`
        SELECT count(*) 
        FROM public.contatos 
        WHERE created_at >= '2026-05-11 00:00:00' 
        AND (etapa_funil ILIKE '%lead%' OR etapa_funil IS NULL)
     `);
     console.log("Total de contatos criados hoje por etapa de funil:", res3.rows[0].count);

     const res4 = await client.query(`
        SELECT tipo, etapa_funil, count(*) 
        FROM public.contatos 
        WHERE created_at >= '2026-05-11 00:00:00' 
        GROUP BY tipo, etapa_funil
     `);
     console.log("Detalhamento por tipo/etapa de contatos criados hoje:");
     console.table(res4.rows);

     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
