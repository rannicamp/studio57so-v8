require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getFeedbacks() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('feedback')
    .select('*, usuarios(nome)')
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);
    
  if (error) {
    console.error("Erro via JS Client:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
getFeedbacks();
