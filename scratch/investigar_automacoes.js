// scratch/investigar_automacoes.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== INVESTIGANDO AUTOMACÕES CADASTRADAS ===");

  try {
    const { data: automacoes, error } = await supabase
      .from('automacoes')
      .select('*');

    if (error) {
      console.error(error);
      return;
    }

    console.log(`Total de automações no banco: ${automacoes.length}`);

    automacoes.forEach(a => {
      console.log(`\nID: ${a.id}`);
      console.log(`Nome: "${a.nome}"`);
      console.log(`Ativo: ${a.ativo}`);
      console.log(`Org: ${a.organizacao_id}`);
      console.log(`Gatilho Tipo: ${a.gatilho_tipo}`);
      console.log(`Gatilho Config:`, JSON.stringify(a.gatilho_config, null, 2));
      console.log(`Ação Tipo: ${a.acao_tipo}`);
      console.log(`Ação Config:`, JSON.stringify(a.acao_config, null, 2));
      console.log("-".repeat(50));
    });

  } catch (err) {
    console.error(err);
  }
}

main();
