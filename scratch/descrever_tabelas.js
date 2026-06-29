// scratch/descrever_tabelas.js
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
  console.log("=== DESCREVENDO TABELAS DE FUNIL ===");
  
  // 1. Mostrar 1 registro de funis
  const { data: funil, error: errF } = await supabase
    .from('funis')
    .select('*')
    .limit(1);
    
  if (errF) {
    console.error("Erro ao ler funis:", errF.message);
  } else {
    console.log("\nEstrutura de funis (Exemplo):");
    console.log(funil[0]);
  }

  // 2. Mostrar 1 registro de colunas_funil
  const { data: coluna, error: errC } = await supabase
    .from('colunas_funil')
    .select('*')
    .limit(1);
    
  if (errC) {
    console.error("Erro ao ler colunas_funil:", errC.message);
  } else {
    console.log("\nEstrutura de colunas_funil (Exemplo):");
    console.log(coluna[0]);
  }

  // 3. Mostrar 1 registro de contatos_no_funil
  const { data: leadNoFunil, error: errL } = await supabase
    .from('contatos_no_funil')
    .select('*')
    .limit(1);
    
  if (errL) {
    console.error("Erro ao ler contatos_no_funil:", errL.message);
  } else {
    console.log("\nEstrutura de contatos_no_funil (Exemplo):");
    console.log(leadNoFunil[0]);
  }
}

main();
