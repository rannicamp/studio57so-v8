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
  return 'REMOVED_PASSWORD'; // Fallback
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
    
    console.log("=== PRIMEIROS 30 EXTERNAL_IDS E FAMÍLIAS DE PINTURA INTERNA ===");
    const res = await client.query(`
      SELECT 
        id, 
        external_id, 
        categoria, 
        familia, 
        tipo, 
        is_active,
        (propriedades->>'Área')::numeric as area
      FROM public.elementos_bim
      WHERE projeto_bim_id = 41 AND tipo = 'PINTURA INTERNA'
      ORDER BY external_id ASC
      LIMIT 30
    `);
    console.table(res.rows);

    console.log("\n=== E SE AGRUPARMOS PELO PREFIXO DO GUID (HÍFEN) ===");
    const resGroup = await client.query(`
      SELECT 
        split_part(external_id, '-', 1) || '-' || split_part(external_id, '-', 2) || '-' || split_part(external_id, '-', 3) || '-' || split_part(external_id, '-', 4) || '-' || split_part(external_id, '-', 5) as guid_prefix,
        COUNT(*) as total
      FROM public.elementos_bim
      WHERE projeto_bim_id = 41 AND tipo = 'PINTURA INTERNA'
      GROUP BY guid_prefix
      ORDER BY total DESC
    `);
    console.table(resGroup.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
