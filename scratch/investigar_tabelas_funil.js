// scratch/investigar_tabelas_funil.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== INVESTIGANDO TABELAS DE FUNIL REAL ===");
  
  // 1. Listar funis
  const { data: funis, error: errF } = await supabase
    .from('funis')
    .select('*');
    
  if (errF) {
    console.error("Erro ao buscar funis:", errF.message);
  } else {
    console.log("\nFunis encontrados na tabela 'funis':");
    console.table(funis.map(f => ({
      ID: f.id,
      Nome: f.nome,
      Org_ID: f.organizacao_id,
      Criado_Em: f.created_at
    })));
  }

  // 2. Buscar colunas_funil
  const { data: colunas, error: errC } = await supabase
    .from('colunas_funil')
    .select('*')
    .order('funil_id', { ascending: true })
    .order('ordem', { ascending: true });
    
  if (errC) {
    console.error("Erro ao buscar colunas_funil:", errC.message);
  } else {
    console.log("\nColunas encontradas na tabela 'colunas_funil':");
    console.table(colunas.map(c => ({
      ID: c.id,
      Nome: c.nome,
      Funil_ID: c.funil_id,
      Ordem: c.ordem,
      Org_ID: c.organizacao_id
    })));
  }
}

main();
