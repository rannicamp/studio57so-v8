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
    
    // 1. Listar mapeamentos da organização 2
    console.log("=== MAPEAMENTOS DA ORGANIZAÇÃO 2 ===");
    const mapeamentos = await client.query(`
      SELECT id, propriedade_nome, propriedade_quantidade, categoria_bim, familia_bim, tipo_bim, elemento_id, tipo_vinculo, escopo, material_id, sinapi_id, vinculo_pai_id, organizacao_id
      FROM public.bim_mapeamentos_propriedades
      WHERE organizacao_id = 2
    `);
    console.table(mapeamentos.rows);

    // 2. Buscar informações dos insumos/materiais mapeados
    console.log("\n=== DETALHES DO SINAPI MAPADO ===");
    const sinapis = await client.query(`
      SELECT id, nome, unidade_medida, preco_unitario
      FROM public.sinapi
      WHERE id IN (
        SELECT sinapi_id FROM public.bim_mapeamentos_propriedades WHERE organizacao_id = 2 AND sinapi_id IS NOT NULL
      )
    `);
    console.table(sinapis.rows);

    // 3. Rodar a RPC de quantitativos
    console.log("\n=== RODANDO A RPC get_quantitativos_orcamentacao_bim ===");
    // Assinatura: get_quantitativos_orcamentacao_bim(p_organizacao_id bigint, p_empreendimento_id bigint, p_projeto_ids bigint[])
    const rpcRes = await client.query(`
      SELECT key, mapeamento_id, nome, unidade, preco_unitario, quantidade, qtd_elementos, array_length(external_ids_ativos, 1) as ativos_count, array_length(external_ids_inativos, 1) as inativos_count, material_id, sinapi_id, etapa_id, subetapa_id, etapa_nome, subetapa_nome, custo_total
      FROM public.get_quantitativos_orcamentacao_bim(2, 1, ARRAY[41]::bigint[])
    `);
    console.table(rpcRes.rows);

    // 4. Vamos buscar se existe algum mapeamento associado a PINTURA no banco, mesmo em outras organizações
    console.log("\n=== MAPEAMENTOS GLOBAIS DE OUTRAS ORGS ===");
    const mapeamentosGlobais = await client.query(`
      SELECT id, propriedade_nome, propriedade_quantidade, categoria_bim, familia_bim, tipo_bim, elemento_id, tipo_vinculo, escopo, material_id, sinapi_id, vinculo_pai_id, organizacao_id
      FROM public.bim_mapeamentos_propriedades
      WHERE (tipo_bim ILIKE '%PINTURA%' OR categoria_bim ILIKE '%PINTURA%')
    `);
    console.table(mapeamentosGlobais.rows);

  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();

