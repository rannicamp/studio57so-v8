require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const org_id = 7; 
  // find a main category Despesa
  const { data: categories } = await supabase.from('categorias_financeiras').select('*').is('parent_id', null).eq('tipo', 'Despesa').limit(1);
  if (!categories || categories.length === 0) return;
  const parentId = categories[0].id.toString(); 

  const dadosParaSalvar = {
     nome: 'Teste Subcategoria IA Mismatched',
     tipo: 'Receita', // mismatched!
     parent_id: parentId,
     organizacao_id: org_id
  };

  const { data, error } = await supabase
      .from('categorias_financeiras')
      .insert(dadosParaSalvar)
      .select();

  console.log('Error:', error);
  console.log('Data:', data);
  if (data) {
     await supabase.from('categorias_financeiras').delete().eq('id', data[0].id);
  }
}
run();
