require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listEmpreendimentos() {
  const { data, error } = await supabase
    .from('empreendimentos')
    .select('id, nome, organizacao_id');
  
  if (error) {
    console.error('Erro ao listar empreendimentos:', error);
  } else {
    console.log('Empreendimentos encontrados:');
    console.table(data);
  }
}

listEmpreendimentos();
