const { Client } = require('pg');

async function main() {
  const password = "REMOVED_PASSWORD";
  const host = "db.vhuvnutzklhskkwbpxdz.supabase.co";
  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
     await client.connect();
     console.log("Conectado. Buscando RPCs com 'saldo', 'antecip' ou 'conta'...");
     
     const res = await client.query(`
       SELECT proname, prosrc 
       FROM pg_proc 
       JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
       WHERE pg_namespace.nspname = 'public' 
         AND (proname ILIKE '%saldo%' OR proname ILIKE '%antecip%' OR proname ILIKE '%conta%');
     `);
     
     console.log(`Encontradas ${res.rows.length} funções:`);
     res.rows.forEach(r => {
       console.log(`\n==========================================`);
       console.log(`FUNÇÃO: ${r.proname}`);
       console.log(`==========================================`);
       console.log(r.prosrc.substring(0, 1500)); // Mostrar início
     });

  } catch(e) {
     console.error("Erro:", e.message);
  } finally {
     await client.end();
  }
}

main().catch(console.error);
