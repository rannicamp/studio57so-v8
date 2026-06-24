import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: emps, error } = await supabaseAdmin.from('empreendimentos')
    .select('id, nome, descricao, dossie_ia, organizacao_id');

  if (error) {
    console.error("Erro ao buscar empreendimentos:", error.message);
    return;
  }

  console.log("=== EMPREENDIMENTOS NO BANCO DE DADOS ===");
  emps.forEach(e => {
    console.log(`\nID: ${e.id} | Nome: "${e.nome}" | Org ID: ${e.organizacao_id}`);
    console.log(`Descrição: ${e.descricao}`);
    console.log(`Dossiê IA (Resumo): ${e.dossie_ia ? e.dossie_ia.substring(0, 500) + '...' : 'Sem dossiê'}`);
    console.log("-------------------------------------------------------------------");
  });
}

run();
