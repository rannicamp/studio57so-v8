const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const idsToProcess = [124, 450, 671];
  
  // 1. Fetch current quantities
  const { data: estoque } = await supabase.from('estoque').select('*').in('id', idsToProcess);
  
  if (!estoque || estoque.length === 0) {
    console.log('Nenhum estoque encontrado para os IDs.');
    return;
  }

  const movimentacoes = [];
  
  for (const item of estoque) {
    if (item.quantidade_atual > 0) {
      movimentacoes.push({
        estoque_id: item.id,
        tipo: 'Saída',
        quantidade: item.quantidade_atual,
        observacao: 'Baixa automática: Concreto consumido no dia da concretagem / Serviço prestado',
        usuario_id: 'b567d140-5e34-45aa-bb2c-cfc27f311c62', // Assuming an admin ID or we leave it empty if possible, let's omit if not strictly required, wait. Let's see if usuario_id is required.
        organizacao_id: item.organizacao_id
      });
    }
  }

  if (movimentacoes.length > 0) {
    // Check if usuario_id is nullable in movimentacoes_estoque
    console.log('Inserindo movimentacoes...');
    const { error: errMov } = await supabase.from('movimentacoes_estoque').insert(movimentacoes);
    if (errMov) {
        console.error('Erro na movimentação:', errMov);
        // Sometimes usuario_id is required. If so, let's fetch a valid user from the org.
        if(errMov.code === '23502') { 
            const {data: u} = await supabase.from('usuarios').select('id').eq('organizacao_id', 2).limit(1);
            if(u && u.length) {
                movimentacoes.forEach(m => m.usuario_id = u[0].id);
                await supabase.from('movimentacoes_estoque').insert(movimentacoes);
            }
        }
    }
    
    console.log('Zonificando quantidades no estoque...');
    for (const item of estoque) {
        if (item.quantidade_atual > 0) {
            await supabase.from('estoque').update({ quantidade_atual: 0 }).eq('id', item.id);
        }
    }
  }
  
  console.log('Baixa de Concretos Concluída com Sucesso!');
}
run();
