const { Client } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
envFile.split(/\r?\n/).forEach(l => {
  if (l.startsWith('SUPABASE_DATABASE_URL=')) {
    dbUrl = l.substring('SUPABASE_DATABASE_URL='.length).trim().replace(/['"]/g, '');
  }
});

if (!dbUrl) {
  console.error("FALHA: SUPABASE_DATABASE_URL nao encontrada.");
  process.exit(1);
}

// Convert port 5432 to 6543 for safe direct connections over Vercel/Node
dbUrl = dbUrl.replace(':5432', ':6543');

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('supabase/unificar_definitivo.sql', 'utf8');
    await client.query(sql);
    console.log("SUCESSO: Nova funcao instalada!");
  } catch (err) {
    console.error("ERRO:", err.message);
  } finally {
    await client.end();
  }
}

run();
