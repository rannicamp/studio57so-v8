require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("=== BUSCANDO MIKAELLY ===");
  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, tipo_contato, organizacao_id')
    .ilike('nome', '%mikaelly%');
    
  if (errC) {
    console.error("Erro contatos:", errC);
  } else {
    console.log("Contatos encontrados:", contatos);
  }

  console.log("=== BUSCANDO EMPREENDIMENTO BETA SUÍTES ===");
  const { data: emps, error: errE } = await supabase
    .from('empreendimentos')
    .select('id, nome, organizacao_id')
    .ilike('nome', '%beta%');
    
  if (errE) {
    console.error("Erro empreendimentos:", errE);
  } else {
    console.log("Empreendimentos encontrados:", emps);
  }
}

run();
