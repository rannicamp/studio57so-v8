require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  const updates = [
      {
          id: 86,
          diagnostico: "Falha de ciclo de vida da extensão MarkupsCore do Autodesk Viewer. Quando o usuário clica em 'Cancelar', a função leaveEditMode() é chamada, mas a ferramenta interativa (EditModeTool) ainda prende os eventos da câmera, mantendo a tela congelada sem permitir orbit.",
          solucao: "Refatorar 'useBimMarkup.js'. Em 'leaveMarkupMode', liberar o tool explicitamente com changeEditMode(null) e resetar a navegação da câmera do viewer para restaurar os controles normais, além de chamar o hide() na extensão do Markup antes de sair do modo de edição."
      },
      {
          id: 87,
          diagnostico: "O esquema de Pedidos e Compras assume que todo pedimento é um material físico (equipamento ou insumo). Serviços comprados caem na mesma fila de baixa física do almoxarifado, o que logicamente é incorreto pois serviços não entram ou saem de estoque (recebimento virtual).",
          solucao: "O módulo de Pedidos de Compra precisa urgentemente criar conceito de que Pedido de tipo 'Material' abriga só Itens físicos, e aceitar Pedidos tipo 'Serviço'. Ao entregar um 'Serviço', a baixa do estoque e registro de material_historico tem de ser abortado e substituído apenas pela liberação da fatura a pagar (Contas a Pagar)."
      },
      {
          id: 88,
          diagnostico: "O atalho 'Ctrl+A' que invoca a adição expressa de atividades está interceptando o evento com 'event.preventDefault()' de forma global em 'MainLayoutClient.js', destruindo a funcionalidade nativa do navegador que os redatores usam para 'Selecionar Tudo' em textos longos.",
          solucao: "Remover a instrução 'event.preventDefault()' e o disparo do modal atrelado a (event.ctrlKey || event.metaKey) && event.key === 'a' dentro do useEffect do arquivo 'MainLayoutClient.js'."
      },
      {
          id: 89,
          diagnostico: "Erro de assinatura Hash do Next.js (Failed to find Server Action). Trata-se de uma anomalia client-side onde o cliente possui um form ou função referenciando uma Server Action que teve seu hash reempacotado num build mais recente.",
          solucao: "O usuário precisa simplesmente realizar um Hard Reload (Ctrl+F5) para deletar o script de cache antigo, ou executar o script local 'npm run clean' se estiver usando o ambiente de desenvolvimento. O ticket pode ser marcado como Implementado pois não é um erro físico do Studio 57."
      }
  ];

  for(const item of updates) {
      const { error } = await supabase
          .from('feedback')
          .update({ diagnostico: item.diagnostico, plano_solucao: item.solucao })
          .eq('id', item.id);
          
      if(error) console.error(`Erro no Ticket ${item.id}:`, error);
      else console.log(`Ticket ${item.id} atualizado.`);
  }
}

runAtualizacao().catch(console.error);
