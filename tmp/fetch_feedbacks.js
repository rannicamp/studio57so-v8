const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function getFeedbacks() {
  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);

  if (error) {
    console.error("Erro ao buscar feedbacks:", error);
    return;
  }

  // Fetch author details
  for (const fb of feedbacks) {
    if (fb.usuario_id || fb.autor_id) {
       const u_id = fb.usuario_id || fb.autor_id;
       const { data: funcInfo } = await supabase.from('funcionarios').select('nome').eq('usuario_id', u_id).single();
       if (funcInfo) {
           fb.autor_nome = funcInfo.nome;
       }
    }
    
    if (fb.organizacao_id) {
       const { data: orgInfo } = await supabase.from('organizacoes').select('entidade_principal_id, nome').eq('id', fb.organizacao_id).single();
       if (orgInfo) {
           fb.organizacao_nome = orgInfo.nome;
           if (orgInfo.entidade_principal_id) {
               const { data: empInfo } = await supabase.from('cadastro_empresa').select('razao_social, nome_fantasia').eq('id', orgInfo.entidade_principal_id).single();
               if(empInfo) fb.empresa_nome = empInfo.razao_social || empInfo.nome_fantasia;
           }
       }
    }
  }

  fs.writeFileSync('./tmp/feedbacks.json', JSON.stringify(feedbacks, null, 2));
  console.log("Feedbacks saved to ./tmp/feedbacks.json");
}

getFeedbacks();
