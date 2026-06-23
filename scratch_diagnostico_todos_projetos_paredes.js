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
    
    console.log("=== TODOS OS PROJETOS BIM DO EMPREENDIMENTO 1 ===");
    const res = await client.query(`
      SELECT id, nome_arquivo, versao, status, is_lixeira, criado_em, atualizado_em
      FROM public.projetos_bim
      WHERE empreendimento_id = 1
      ORDER BY criado_em DESC
    `);
    console.table(res.rows);

    console.log("\n=== CONTAGEM DE ELEMENTOS DE CADA PROJETO DO EMPREENDIMENTO 1 ===");
    const countRes = await client.query(`
      SELECT 
        e.projeto_bim_id, 
        p.nome_arquivo, 
        p.versao, 
        p.is_lixeira,
        COUNT(*) as total_elementos,
        SUM(CASE WHEN e.is_active = true THEN 1 ELSE 0 END) as ativos
      FROM public.elementos_bim e
      JOIN public.projetos_bim p ON e.projeto_bim_id = p.id
      WHERE p.empreendimento_id = 1
      GROUP BY e.projeto_bim_id, p.nome_arquivo, p.versao, p.is_lixeira
      ORDER BY e.projeto_bim_id DESC
    `);
    console.table(countRes.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
