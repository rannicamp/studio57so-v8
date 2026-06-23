require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

function getPassword() {
  if (process.env.SUPABASE_DB_PASSWORD) return process.env.SUPABASE_DB_PASSWORD;
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
  try {
    if (fs.existsSync('.env.db')) {
      const dbEnv = fs.readFileSync('.env.db', 'utf8');
      const match = dbEnv.match(/SUPABASE_DB_PASSWORD=(.+)/);
      if (match) return match[1].trim();
    }
  } catch {}
  return 'Srbr19010720@'; // Fallback
}

const envFile = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
envFile.split(/\r?\n/).forEach(l => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = l.substring('NEXT_PUBLIC_SUPABASE_URL='.length).trim().replace(/['"]/g, '');
  }
});

const baseHost = supabaseUrl.replace('https://', '').split('/')[0];
const projectId = baseHost.split('.')[0];
const host = `db.${projectId}.supabase.co`;
const password = getPassword();
const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

const client = new Client({ 
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    console.log("=== BUSCANDO MATERIAIS COM NOME PINTURA OU EMBOÇO OU DRYWALL ===");
    const materiais = await client.query(`
      SELECT id, nome, unidade_medida, preco_unitario
      FROM public.materiais
      WHERE nome ILIKE '%PINTURA%' OR nome ILIKE '%EMBOÇO%' OR nome ILIKE '%DRYWALL%'
      LIMIT 10
    `);
    console.table(materiais.rows);

    console.log("\n=== BUSCANDO SINAPI COM NOME PINTURA OU EMBOÇO OU DRYWALL ===");
    const sinapis = await client.query(`
      SELECT id, nome, unidade_medida, preco_unitario
      FROM public.sinapi
      WHERE nome ILIKE '%PINTURA%' OR nome ILIKE '%EMBOÇO%' OR nome ILIKE '%DRYWALL%'
      LIMIT 10
    `);
    console.table(sinapis.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
