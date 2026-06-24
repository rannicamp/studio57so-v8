import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: emps, error } = await supabaseAdmin.from('empreendimentos')
    .select('id, nome, listado_para_venda, organizacao_id, dossie_ia, observacoes, categoria')
    .eq('organizacao_id', 2);

  if (error) {
    console.error("Erro ao buscar empreendimentos:", error.message);
    return;
  }

  console.log("=== EMPREENDIMENTOS DA ORG 2 ===");
  emps.forEach(e => {
    console.log(`\nID: ${e.id} | Nome: "${e.nome}" | Categoria: ${e.categoria} | Listado Venda: ${e.listado_para_venda}`);
    console.log(`Observações: ${e.observacoes}`);
    console.log(`Dossiê IA:\n${e.dossie_ia || 'Sem dossiê'}`);
    console.log("-------------------------------------------------------------------");
  });
}

run();
