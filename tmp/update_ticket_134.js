require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
  const SSL = { rejectUnauthorized: false };
  const client = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
  
  try {
     await client.connect();
     await client.query("UPDATE feedback SET status = 'Implementado', comentarios = 'Solucionado adicionando a opção de Valor na edição em lote do Financeiro.' WHERE id = 134");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
