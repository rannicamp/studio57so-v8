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
    
    console.log("=== BUSCANDO SINAPI ID PARA O CODIGO 88416 ===");
    const sinapiItem = await client.query(`
      SELECT id, nome, unidade_medida, preco_unitario
      FROM public.sinapi
      WHERE id = 88416 OR nome LIKE '%88416%'
    `);
    console.table(sinapiItem.rows);

    const sinapiId = sinapiItem.rows[0]?.id;

    console.log("\n=== BUSCANDO MAPEAMENTOS PARA O CODIGO 88416 OU SINAPI ===");
    const mapeamentos = await client.query(`
      SELECT *
      FROM public.bim_mapeamentos_propriedades
      WHERE sinapi_id = 88416 OR propriedade_nome ILIKE '%SINAPI%' OR propriedade_quantidade ILIKE '%SINAPI%'
    `);
    console.table(mapeamentos.rows);

    // E se buscarmos na tabela de materiais (por ID 88416)?
    console.log("\n=== BUSCANDO MATERIAIS COM ID 88416 ===");
    const materiais = await client.query(`
      SELECT id, nome, unidade_medida, preco_unitario
      FROM public.materiais
      WHERE id = 88416
    `);
    console.table(materiais.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
