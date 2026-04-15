require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const atualizacoes = [
    {
      id: 115,
      diagnostico: "O campo Modal de Edição (LancamentoDetalhesSidebar) altera apenas a coluna `data_vencimento` na tabela `lancamentos`. Como este lançamento possui um `fatura_id` vinculado, a view continua forçando a renderização do lançamento no contêiner da fatura anterior/originária (Cartão de Crédito).",
      plano_solucao: "Refatorar o método `handleAjustarVencimento` em `LancamentoDetalhesSidebar.js` e criar uma RPC (ex: `processar_nova_data_fatura`) que verifique se o lançamento era de cartão. Se for, remover a foreign key `fatura_id` antiga e reassociar/cadastrar ao ID da fatura correspondente ao mês escolhido."
    },
    {
      id: 107,
      diagnostico: "O Reference Error capturado demonstra que a função nativa `urlBase64ToUint8Array` está sendo evocada na rotina de registro do Web Push (Subscription) na linha 232 do arquivo `ConfiguracaoNotificacoes.js` sem ter sido sequer declarada ou importada no ambiente.",
      plano_solucao: "Inserir o bloco declarativo da função utilitária global `urlBase64ToUint8Array` (que converte o base64 para buffer) dentro do arquivo `ConfiguracaoNotificacoes.js` ou efetuar sua importação dos utils da aplicação, estabilizando e permitindo o registro VAPID no Mobile Safari do iPad."
    },
    {
      id: 109,
      diagnostico: "O conflito relatado ('Mensagens falham e chegam fora de ordem') é desencadeado normalmente pela ausência de id temporal UUID próprio de envio otimista na Web UI, gerando corrida entre o dispatching optimistic e os responses de Webhook. No caso Leda Araújo especificamente, possivelmente tentativas subsequentes sofreram bloqueios ou gargalo.",
      plano_solucao: "Restruturar o Reducer local do Zustand e dos componentes de Caixa de Entrada. Ao enviar um payload, criar interface unificada (com UUID do client) ordenando a fila por `sent_at` independente das chaves de banco de longo prazo, garantindo persistência sem flickering de UI."
    },
    {
      id: 114,
      diagnostico: "Solicitação Simples de UX. Ausência do feature nativo na reprodução da View de áudio.",
      plano_solucao: "Adicionar o recurso *Playback Rate Selector* (1x, 1.5x, 2x) através de um pequeno botão flutuante amarrado ao ref nativo `<audio>` dentro de `AudioMessageBubble.js`."
    },
    {
      id: 106,
      diagnostico: "O disparo de localizações requer estrutura especial em `type: 'location'` via a Meta API. Possível payload em `sendWabaMessage` não construído corretamente, enviando conteúdo genérico em requisição POST malformada.",
      plano_solucao: "Validar e adequar a rota de backend de envio (`/api/waba/send`) para interceptar o mimetype `location` ou `latitude/longitude` e passar para o Body do Graph API nos keys e schemas nativos oficiais da documentação do WhatsApp Cloud."
    },
    {
      id: 110,
      diagnostico: "A exclusão / leitura cruzada na interface do Caixa de Entrada atual não está repassando a RPC correta ou está repassando de forma agnóstica para zear `user_unread_counts` de maneira sincronizada após mudança de aba.",
      plano_solucao: "Validar se as chamadas de API de `markMessagesAsRead` no componente de Inbox estão resetando a árvore de notificações otimistas e aguardando as confirmações reais no backend."
    },
    {
      id: 111,
      diagnostico: "Desincronia no webhook gerando mensagens que 'chegam e outras não', associada à ordenação de IDs do Supabase realtime (race condition com cache browser).",
      plano_solucao: "Criar sistema de ordenamento estrito em `whatsapp_messages` baseado em timestamp real (`sent_at`) ao preencher o Redux/Zustand local, e repassar falhas como 'unacknowledged'."
    },
    {
      id: 112,
      diagnostico: "Igual ao bug 111, gerado pelos problemas na atualização de view React de listagem de janelas e conversas nos hooks da página `data-fetching.js`.",
      plano_solucao: "Alterar a view e query de `getConversations` no modulo data-fetching para priorizar estritamente o `last_message_at`, com listeners RealTime explicitamente atualizando a prioridade deste timestamp para empurrar o card ao topo sem delay."
    },
    {
      id: 113,
      diagnostico: "Feature ausente (Foi desativada na mudança).",
      plano_solucao: "Reincorporar o componente 'wpp message modal' diretamente nos elementos `ColumnKanban.js` & `LeadsBoard` do CRM."
    },
    {
      id: 108,
      diagnostico: "A Mensagem Meta Genérica (#131000) aparece quando uma precondição é ferida sem motivo específico documentado - usualmente janela de atendimento expirada (>24h do último contato do cliente) enquanto o usuário tenta forçar envio de uma mensagem livre.",
      plano_solucao: "Implementar e forçar a validação da janela do cliente: comparar o atual horário com `last_inbound_at`. Se expirado, travar e desativar o input box normal na inferface (bloqueando o envio em HTML5), substituindo-o por um botão 'Abrir Seletor de Arquivos e Templates do WhatsApp' validado, impedindo a requisição fantasma para a Meta."
    }
  ];

  for (const info of atualizacoes) {
    const { error } = await supabase
      .from('feedback')
      .update({
        diagnostico: info.diagnostico,
        plano_solucao: info.plano_solucao
      })
      .eq('id', info.id);

    if (error) {
      console.error(`Erro ao atualizar o ID ${info.id}:`, error);
    } else {
      console.log(`Successo ao atualizar o plano_solucao do ID ${info.id}`);
    }
  }
}

runAtualizacao();
