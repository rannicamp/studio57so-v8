require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getNames() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: func } = await supabase.from('funcionarios').select('nome_display').eq('user_id', '4046a5ad-f198-4309-99ab-3b8fed59cad1').single();
  const { data: org } = await supabase.from('organizacoes').select('entidade_principal_id').eq('id', 2).single();
  let orgName = 'Desconhecida';
  if (org && org.entidade_principal_id) {
     const { data: emp } = await supabase.from('cadastro_empresa').select('razao_social, nome_fantasia').eq('id', org.entidade_principal_id).single();
     orgName = emp ? (emp.nome_fantasia || emp.razao_social) : 'Desconhecida';
  }
  console.log('Autor:', func ? func.nome_display : 'Desconhecido');
  console.log('Organizacao:', orgName);
}
getNames();
