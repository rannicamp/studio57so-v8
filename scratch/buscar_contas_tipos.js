const { Client } = require('pg');

async function main() {
  const password = "REMOVED_PASSWORD";
  const host = "db.vhuvnutzklhskkwbpxdz.supabase.co";
  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
     await client.connect();
     console.log("Conectado. Buscando contas financeiras...");
     
     const res = await client.query(`
       SELECT id, nome, tipo, organizacao_id 
       FROM public.contas_financeiras
       ORDER BY tipo, nome;
     `);
     
     console.log(`Encontradas ${res.rows.length} contas:`);
     res.rows.forEach(r => {
       console.log(` - [ID ${r.id}] Nome: ${r.nome} | Tipo: ${r.tipo} | Org: ${r.organizacao_id}`);
     });

  } catch(e) {
     console.error("Erro:", e.message);
  } finally {
     await client.end();
  }
}

main().catch(console.error);
