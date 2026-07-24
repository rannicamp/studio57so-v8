require('c:/Projetos/studio57so-v8/node_modules/dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });
const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || 'REMOVED_PASSWORD';
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0] 
    : 'db.vhuvnutzklhskkwbpxdz.supabase.co';
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`; // standard port 6543
  const client = new Client({ 
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
     console.log("Conectando no banco...");
     await client.connect();
     
     console.log("\n1. Buscando a definição de auto_merge_contacts_and_relink...");
     const resDef = await client.query(
       `SELECT routine_definition, routine_name 
        FROM information_schema.routines 
        WHERE routine_type = 'FUNCTION' 
          AND specific_schema = 'public'
          AND routine_name = 'auto_merge_contacts_and_relink'`
     );
     
     if (resDef.rows.length === 0) {
       console.log("Função auto_merge_contacts_and_relink não encontrada.");
     } else {
       console.log("Found definition.");
       console.log(resDef.rows[0].routine_definition);
     }

     console.log("\n2. Tentando executar a fusão diretamente via SQL...");
     // Run the function with transaction to see what exception is thrown
     await client.query("BEGIN;");
     try {
       const resMerge = await client.query(
         `SELECT auto_merge_contacts_and_relink($1, $2)`,
         [[6576, 6577], 2]
       );
       console.log("Success! Result:", resMerge.rows);
       await client.query("COMMIT;");
     } catch (errMerge) {
       console.error("Exception during merge execution:", errMerge.message);
       await client.query("ROLLBACK;");
     }

  } catch(e) {
     console.error("FALHA NA EXECUÇÃO:", e.message);
  } finally {
      await client.end();
  }
}

runSQL();
