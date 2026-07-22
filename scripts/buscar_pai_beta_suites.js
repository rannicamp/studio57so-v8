// scripts/buscar_pai_beta_suites.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("Buscando possíveis atividades pai para o Beta Suítes...");
  const { data, error } = await supabase
    .from('activities')
    .select('id, nome, status, atividade_pai_id')
    .eq('empreendimento_id', 5)
    .or('nome.ilike.%projeto%,nome.ilike.%elaboração%');

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log("Atividades encontradas:", data);
}

run();
