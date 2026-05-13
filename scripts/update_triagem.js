require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const updates = [
    {
      id: 136,
      diagnostico: "O front-end usa `.substring(0, 19)` para exibir a data `created_at` (que chega em UTC). Esse corte força o JavaScript a ler a data como se fosse do fuso local, pulando o reajuste de fuso e mostrando horário adiantado em 3 horas.",
      plano_solucao: "Substituir o recorte pela leitura completa via `new Date(dateString)` para que a biblioteca converta ao fuso correto brasileiro antes da exibição.",
      status: "Em Análise"
    },
    {
      id: 135,
      diagnostico: "A ausência ocorre pois o sino (`NotificationBell`) e o painel (`NotificacoesWidget`) só consultam novas notificações via polling a cada 10/30s. Falta conexão em tempo real.",
      plano_solucao: "Assinar o canal Realtime do Supabase nestes componentes, forçando `queryClient.invalidateQueries` no exato momento que algo for salvo.",
      status: "Em Análise"
    },
    {
      id: 134,
      diagnostico: "A tela de LancamentosManager não lista o campo 'Valor' dentro da variável `batchUpdateFields` para liberar no modal de Lote.",
      plano_solucao: "Adicionar o campo `{ key: 'valor', label: 'Valor', type: 'number' }` ao escopo do Modal em Lote, habilitando a Mutação genérica.",
      status: "Em Análise"
    },
    {
      id: 137,
      diagnostico: "A Função SQL busca a ID da categoria 'Venda de Imóvel' travando na org do usuário (`organizacao_id = p_organizacao_id`). Pelo Padrão Multitenant, essas categorias base são globais (Matriz).",
      plano_solucao: "Alterar a query interna da RPC para buscar nas duas organizações: `(organizacao_id = p_organizacao_id OR organizacao_id = 1)`.",
      status: "Em Análise"
    }
  ];

  for (const update of updates) {
    const { id, diagnostico, plano_solucao, status } = update;
    const { error } = await supabase
      .from('feedback')
      .update({ diagnostico, plano_solucao, status })
      .eq('id', id);

    if (error) {
      console.error(`Error updating ticket ${id}:`, error.message);
    } else {
      console.log(`Ticket ${id} updated successfully.`);
    }
  }
}
run();
