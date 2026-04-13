require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
  .from('contatos_no_funil')
  .select(`
    id, 
    contatos:contato_id!inner(
      id, nome, 
      activities(id, status, data_fim_prevista)
    )
  `)
  .eq('contatos.nome', 'Giovanna Maria| Advogada Previdenciária');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
main();
