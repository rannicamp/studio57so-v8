// scratch/checar_coluna_especifica.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const ids = ['a4e01138-fe34-4fd6-91fb-f40678b1db79', '902f7707-1f11-4fa6-89c3-b15735acfe1d', 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5'];
  
  for (const id of ids) {
    const { data, error } = await supabase
      .from('colunas_funil')
      .select('*, funis(nome)')
      .eq('id', id)
      .maybeSingle();
      
    console.log(`\nID: ${id}`);
    if (error) {
      console.error("Erro:", error.message);
    } else if (data) {
      console.log(`Nome: "${data.nome}" | Funil: "${data.funis?.nome}" | Org: ${data.organizacao_id} | Tipo: "${data.tipo_coluna}"`);
    } else {
      console.log("Coluna inexistente!");
    }
  }
}

main();
