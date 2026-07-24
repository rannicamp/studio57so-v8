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
    
    // 1. Imprimir todos os mapeamentos da org 2 de forma detalhada
    console.log("=== TODOS OS MAPEAMENTOS DA ORG 2 ===");
    const mapeamentos = await client.query(`
      SELECT 
        m.id, 
        m.propriedade_nome, 
        m.propriedade_quantidade, 
        m.categoria_bim, 
        m.familia_bim, 
        m.tipo_bim, 
        m.tipo_vinculo, 
        m.escopo, 
        m.material_id, 
        m.sinapi_id,
        m.vinculo_pai_id,
        COALESCE(mat.nome, sin.nome) as insumo_nome
      FROM public.bim_mapeamentos_propriedades m
      LEFT JOIN public.materiais mat ON m.material_id = mat.id
      LEFT JOIN public.sinapi sin ON m.sinapi_id = sin.id
      WHERE m.organizacao_id = 2
    `);
    
    mapeamentos.rows.forEach(r => {
      console.log(`ID: ${r.id} | Vinculo: ${r.tipo_vinculo} | Escopo: ${r.escopo} | Prop: ${r.propriedade_nome} (${r.propriedade_quantidade || 'N/A'})`);
      console.log(`   BIM: Categoria: ${r.categoria_bim} | Familia: ${r.familia_bim} | Tipo: ${r.tipo_bim}`);
      console.log(`   Insumo: ${r.insumo_nome} (Mat: ${r.material_id} / Sinapi: ${r.sinapi_id}) | Pai: ${r.vinculo_pai_id}`);
      console.log("-".repeat(80));
    });

    // 2. Buscar em quais projetos do empreendimento 1 existem elementos de Pintura Interna ou Emboço
    console.log("\n=== OCORRÊNCIA DE ELEMENTOS DE PINTURA/EMBOÇO NOS PROJETOS ===");
    const ocorrencias = await client.query(`
      SELECT 
        e.projeto_bim_id, 
        p.nome_arquivo, 
        p.versao, 
        p.is_lixeira,
        e.tipo,
        COUNT(*) as total_elementos,
        SUM(CASE WHEN e.is_active = true THEN 1 ELSE 0 END) as ativos,
        SUM(CASE WHEN e.is_active = false THEN 1 ELSE 0 END) as inativos
      FROM public.elementos_bim e
      JOIN public.projetos_bim p ON e.projeto_bim_id = p.id
      WHERE p.empreendimento_id = 1
        AND (e.tipo ILIKE '%PINTURA%' OR e.tipo ILIKE '%EMBOÇO%')
      GROUP BY e.projeto_bim_id, p.nome_arquivo, p.versao, p.is_lixeira, e.tipo
      ORDER BY e.projeto_bim_id DESC, total_elementos DESC
    `);
    console.table(ocorrencias.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
