require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function fetchFeedbacks() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: feedbacks, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise']);
    
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  // Now let's try to fetch user and org names
  for (let f of feedbacks) {
    if (f.usuario_id) {
       const { data: func } = await supabase.from('funcionarios').select('nome').eq('user_id', f.usuario_id).single();
       f.nome_usuario = func ? func.nome : 'Desconhecido';
    }
    if (f.organizacao_id) {
       const { data: org } = await supabase.from('organizacoes').select('nome').eq('id', f.organizacao_id).single();
       f.nome_organizacao = org ? org.nome : 'Desconhecida';
    }
  }
    
  fs.writeFileSync('triagem_output.json', JSON.stringify(feedbacks, null, 2));
  console.log('Saved to triagem_output.json');
}

fetchFeedbacks();
