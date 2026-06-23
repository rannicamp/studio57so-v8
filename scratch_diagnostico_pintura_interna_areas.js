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
    
    console.log("=== INSPEÇÃO DE ÁREAS DAS 690 PAREDES DE PINTURA INTERNA ===");
    const res = await client.query(`
      SELECT 
        (propriedades->>'Área')::numeric as area,
        COUNT(*) as total
      FROM public.elementos_bim
      WHERE projeto_bim_id = 41 AND tipo = 'PINTURA INTERNA'
      GROUP BY area
      ORDER BY area DESC
    `);
    console.table(res.rows);

    console.log("\n=== SOMA TOTAL DAS ÁREAS NO BANCO ===");
    const sumRes = await client.query(`
      SELECT 
        SUM((propriedades->>'Área')::numeric) as area_total_sum,
        COUNT(*) as total_elementos,
        SUM(CASE WHEN (propriedades->>'Área') IS NULL THEN 1 ELSE 0 END) as nulos,
        SUM(CASE WHEN (propriedades->>'Área')::numeric = 0 THEN 1 ELSE 0 END) as zeros
      FROM public.elementos_bim
      WHERE projeto_bim_id = 41 AND tipo = 'PINTURA INTERNA'
    `);
    console.table(sumRes.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
