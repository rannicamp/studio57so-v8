// scratch/testar_triagem_ia_rh.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_CONTACT_ID = 5923; // Lead de teste do Ranniere
const ORGANIZACAO_ID = 2; // Org 2

async function run() {
  console.log('=== TESTE DE VALIDAÇÃO: RESOLUÇÃO DE BANCO PARA RH (MULTITENANT) ===');

  // 1. Simular a busca do funil 'Recrutamento & Talentos' para a Org 2
  console.log('\n1. Simulando busca de funil de Recrutamento...');
  const { data: funilRh, error: errF } = await supabase
    .from('funis')
    .select('id, nome')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('nome', 'Recrutamento & Talentos')
    .limit(1)
    .maybeSingle();

  if (errF) {
    console.error("Erro ao buscar funil:", errF.message);
    return;
  }

  console.log(`Funil de RH encontrado:`, funilRh);

  if (!funilRh) {
    console.error("Erro: O funil de RH não foi criado!");
    return;
  }

  // 2. Simular a busca da coluna de tipo 'entrada' do funil
  console.log('\n2. Simulando busca da coluna de entrada do funil de RH...');
  const { data: colRh, error: errC } = await supabase
    .from('colunas_funil')
    .select('id, nome, tipo_coluna')
    .eq('funil_id', funilRh.id)
    .eq('tipo_coluna', 'entrada')
    .limit(1)
    .maybeSingle();

  if (errC) {
    console.error("Erro ao buscar coluna:", errC.message);
    return;
  }

  console.log(`Coluna de RH resolvida:`, colRh);

  if (!colRh) {
    console.error("Erro: A coluna de entrada do funil de RH não foi encontrada!");
    return;
  }

  console.log(`\nValores resolvidos com sucesso: Funil ID = ${funilRh.id}, Coluna Entrada ID = ${colRh.id}`);
  console.log('A resolução de banco multitenant está 100% OPERACIONAL!');
}

run().catch(console.error);
