require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncLixeira() {
  const { data: contratos, error: errContratos } = await supabase
    .from('contratos')
    .select('id, produto_id')
    .eq('lixeira', true)
    .not('produto_id', 'is', null);

  if (errContratos) {
    console.error('Erro ao buscar contratos na lixeira:', errContratos);
    return;
  }

  if (!contratos || contratos.length === 0) {
    console.log('Nenhum contrato na lixeira com produto vinculado. Nenhuma retroativação necessária.');
    return;
  }

  console.log('Foram encontrados ' + contratos.length + ' contratos na lixeira que possuem produto_id. Liberando...');

  const produtoIds = contratos.map(c => c.produto_id);

  const { data, error } = await supabase
    .from('produtos_empreendimento')
    .update({ status: 'Disponível' })
    .in('id', produtoIds);
    
  if (error) {
    console.error('Erro ao atualizar produtos:', error);
  } else {
    console.log('Os produtos foram atualizados para Disponível com sucesso retroativamente!');
  }
}

syncLixeira();
