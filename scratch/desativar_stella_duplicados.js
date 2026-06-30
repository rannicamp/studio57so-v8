// scratch/desativar_stella_duplicados.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DUPLICADOS = [6173, 6178]; // Maria duplicada e Erasto duplicado

async function main() {
  console.log("=== DESATIVANDO PILOTO AUTOMÁTICO DA STELLA PARA DUPLICADOS NO BANCO ===");

  for (const id of DUPLICADOS) {
    console.log(`Buscando contato duplicado ID: ${id}...`);
    const { data: contato, error: errGet } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo')
      .eq('id', id)
      .single();

    if (errGet || !contato) {
      console.error(`Contato ID ${id} não encontrado ou erro:`, errGet?.message);
      continue;
    }

    console.log(`Contato: "${contato.nome}" - Stella IA Status Atual: ${contato.ia_atendimento_ativo}`);

    if (contato.ia_atendimento_ativo) {
      console.log(`Desativando Stella IA para o contato ID ${id}...`);
      const { error: errUpd } = await supabase
        .from('contatos')
        .update({ ia_atendimento_ativo: false })
        .eq('id', id);

      if (errUpd) {
        console.error(`Erro ao desativar Stella IA para ID ${id}:`, errUpd.message);
      } else {
        console.log(`-> Stella IA desativada com sucesso total no contato ID ${id}!`);
      }
    } else {
      console.log("-> A Stella IA já estava desativada para este contato.");
    }
  }

  console.log("\n=== CONCLUÍDO ===");
}

main().catch(console.error);
