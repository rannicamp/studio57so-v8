import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.from('empreendimentos')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Erro ao buscar colunas:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("=== COLUNAS DA TABELA EMPREENDIMENTOS ===");
    console.log(Object.keys(data[0]));
    console.log("\nExemplo de linha:", data[0]);
  } else {
    console.log("Nenhum empreendimento cadastrado.");
  }
}

run();
