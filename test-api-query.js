const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkQuery() {
  const { data, error } = await supabase
      .from('contatos')
      .select(`
        id,
        nome,
        razao_social,
        empresa,
        tipo_contato,
        organizacao_id,
        telefones ( telefone ),
        emails ( email )
      `)
      .eq('id', 2798)
      .single();
  
  console.log('Error:', error);
  console.log('Data:', data);
}

checkQuery();
