import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: cols, error } = await supabaseAdmin.from('colunas_funil')
    .select('id, nome, descricao, ordem, funil_id')
    .eq('organizacao_id', 2)
    .order('ordem', { ascending: true });

  if (error) {
    console.error("Erro ao buscar colunas do funil:", error.message);
    return;
  }

  console.log("=== COLUNAS DO FUNIL (ORG 2) ===");
  console.table(cols);
}

run();
