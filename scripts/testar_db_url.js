// scripts/testar_db_url.js
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function test() {
  const dbUrl = process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    console.log("Variável SUPABASE_DATABASE_URL não configurada.");
    return;
  }

  // Mascarar a senha no log por segurança
  const masked = dbUrl.replace(/:([^:@]+)@/, ':******@');
  console.log("Connection String:", masked);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Conexão estabelecida com sucesso via Postgres!");
    const res = await client.query("SELECT version()");
    console.log("Versão do banco:", res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error("❌ Falha de conexão:", err.message);
    try { await client.end(); } catch (e) {}
  }
}

test();
