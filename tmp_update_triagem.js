require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updates = [
    {
      id: 139,
      diagnostico: "O webhook de WhatsApp (services/crm.js) insere o novo Lead no banco com sucesso, mas carece de uma rotina/trigger para gravar um alerta na tabela `notificacoes` para os usuários.",
      plano_solucao: "Acoplar a lógica de inserção na tabela `notificacoes` logo após a criação do Lead em `findOrCreateContactAndConversation`, utilizando a função `criarNotificacaoGlobal` ou inserindo diretamente."
    },
    {
      id: 142,
      diagnostico: "Mesma causa raiz do ticket 139. Leads são capturados pelo funil via webhook, mas não emitem avisos sonoros ou visuais no painel por falta de inserção de notificação.",
      plano_solucao: "Idêntico ao ticket 139. Resolver os dois com o mesmo ajuste de código em `crm.js`."
    },
    {
      id: 141,
      diagnostico: "No `app/api/whatsapp/send/route.js`, a função `formatarParaWhatsAppBR(to)` é chamada sem informar o DDI. Como ela possui o default `countryCode = '+55'`, ela cega o sistema e injeta '55' até mesmo em números do EUA (ex: 55155...), corrompendo o payload da Meta API.",
      plano_solucao: "Refatorar `utils/phoneUtils.js` para ser sensível ao DDI presente na string (ex: `rawPhone.startsWith('+1')`) e abortar a prefixação forçada de 55 quando o DDI for manifestamente internacional."
    },
    {
      id: 140,
      diagnostico: "O widget de 'Minhas Atividades' no `/painel` (Home) apresenta os dados em leitura (read-only), sem gatilhos `onClick` para acionar a edição.",
      plano_solucao: "Importar e acoplar o componente de edição (`AtividadeFormModal` ou similar) no widget da Dashboard, permitindo a edição sem precisar navegar para outro módulo."
    },
    {
      id: 143,
      diagnostico: "Chamado não caracterizado como Bug sistêmico. Trata-se de uma tarefa arquitetônica operacional alocada incorretamente no painel de feedbacks de software.",
      plano_solucao: "Não há solução sistêmica. O time de engenharia/arquitetura deve desenvolver a planta e anexar ao respectivo empreendimento."
    }
  ];

  for (const item of updates) {
    const { error } = await supabase
      .from('feedback')
      .update({ diagnostico: item.diagnostico, plano_solucao: item.plano_solucao })
      .eq('id', item.id);
      
    if (error) {
      console.error(`Erro ao atualizar ticket ${item.id}:`, error.message);
    } else {
      console.log(`Ticket ${item.id} atualizado com sucesso.`);
    }
  }
}

runAtualizacao().catch(console.error);
