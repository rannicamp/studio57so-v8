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
    
    console.log("=== LISTAGEM DE MODELOS DO EMPREENDIMENTO 1 (RESIDENCIAL ALFA) ===");
    const res = await client.query(`
      SELECT 
        p.id,
        p.nome_arquivo,
        p.versao,
        p.status,
        p.is_lixeira,
        p.urn_autodesk,
        p.criado_em,
        (SELECT COUNT(*) FROM public.elementos_bim e WHERE e.projeto_bim_id = p.id) as total_elementos,
        (SELECT COUNT(*) FROM public.elementos_bim e WHERE e.projeto_bim_id = p.id AND e.is_active = true) as ativos,
        (SELECT COUNT(*) FROM public.elementos_bim e WHERE e.projeto_bim_id = p.id AND e.is_active = false) as inativos
      FROM public.projetos_bim p
      WHERE p.empreendimento_id = 1
      ORDER BY p.nome_arquivo, p.versao DESC, p.criado_em DESC
    `);
    console.table(res.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
