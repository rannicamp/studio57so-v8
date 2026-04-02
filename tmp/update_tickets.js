require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAtualizacao(id, diagnostico, solucao, status) {
  const { data, error } = await supabase
    .from('feedback')
    .update({ 
      diagnostico: diagnostico, 
      plano_solucao: solucao, 
      status: status 
    })
    .eq('id', id);

  if (error) {
    console.error(`Erro ao atualizar ticket ${id}:`, error);
  } else {
    console.log(`Atualizado ticket ${id}`);
  }
}

async function update() {
   try {
       await runAtualizacao(
           90, 
           'O botão novo colaborador havia sido removido acidentalmente do cabecalho unificado.', 
           'Recoloquei a chamada do botão que abre o FuncionarioModal no cabecalho, ao lado do botão de Importar.', 
           'Implementado'
       );
       await runAtualizacao(
           91, 
           'O dropdown não permitia buscar subcategorias. O limite de herança estava bloqueado apenas nas categorias raízes.', 
           'Desenvolvido dropdown customizado com pesquisa, liberação infinita de hierarquia no BD e filtro por tipo de categoria. Botões de ação rápida adicionados no app.', 
           'Implementado'
       );
   } catch(e) {
       console.error(e);
   }
}
update();
