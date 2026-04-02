require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const org_id = 7; // Just testing
  // find a main category
  const { data: categories } = await supabase.from('categorias_financeiras').select('*').is('parent_id', null).limit(1);
  if (!categories || categories.length === 0) {
    console.log('No parent category found');
    return;
  }
  const parentId = categories[0].id.toString(); // simulate string from select
  console.log('Using parent_id:', parentId);

  const dadosParaSalvar = {
     nome: 'Teste Subcategoria IA',
     tipo: categories[0].tipo,
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
