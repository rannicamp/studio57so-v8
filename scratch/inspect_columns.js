const { Client } = require('pg');

async function main() {
  const password = "Srbr19010720@";
  const host = "db.vhuvnutzklhskkwbpxdz.supabase.co";
  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
     await client.connect();
     console.log("Conectado. Buscando colunas da tabela bim_mapeamentos_propriedades...");
     
     const res = await client.query(`
       SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'public' 
         AND table_name = 'bim_mapeamentos_propriedades'
       ORDER BY ordinal_position;
     `);
     
     console.log("Colunas encontradas:");
     res.rows.forEach(r => {
       console.log(` - ${r.column_name}: ${r.data_type}`);
     });

  } catch(e) {
     console.error("Erro:", e.message);
  } finally {
     await client.end();
  }
}

main().catch(console.error);
