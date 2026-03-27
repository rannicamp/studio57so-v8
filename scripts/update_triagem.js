require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao(id, diagnostico, solucao, novoStatus = null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  let updateData = { diagnostico: diagnostico, plano_solucao: solucao };
  if (novoStatus) {
      updateData.status = novoStatus;
  }
  
  const { error } = await supabase.from('feedback').update(updateData).eq('id', id);
  if (error) {
     console.error(`Erro ao atualizar Ticket ${id}:`, error.message);
  } else {
     console.log(`Ticket ${id} atualizado.`);
  }
}

async function start() {
    // Ticket 75 (Resolvido)
    await runAtualizacao(75, 
      "A trava ocorria devido à ausência de foreign keys específicas ('empresa_id') da arquitetura Multi-Tenant imposta pela migração SaaS, impedindo a engine de delegar os leads para a organização correta.", 
      "Garantido o preenchimento da chave 'empresa_id' e ajustes no workflow para refletir o roteamento correto no pipeline. Correção estrutural já efetuada.",
      "Implementado"
    );

    // Ticket 76 (Resolvido)
    await runAtualizacao(76, 
      "O webhook do Facebook/Meta disparava eventos em massa e a API do Next.js processava notificações redundantes ao encontrar UUIDs duplicados ou por falta de debounce.", 
      "Adicionado bloqueio de cache/verificação de idempotência no processamento do Lead para ignorar pacotes duplicados vindos da Meta. Correção já efetuada.",
      "Implementado"
    );

    // Ticket 77 (Resolvido)
    await runAtualizacao(77, 
      "A falha de comunicação WABA (WhatsApp) interrompeu o websocket e a rota de API devido a tokens expirados e falhas no Embedded Signup, provocando erro 401 Unauthorized da Meta.", 
      "Migração do WhatsApp completada com sucesso para arquitetura SaaS. Tokens permanentes de Sistema atestados e Handshake Oauth da Meta reestabelecido e roteado pela organização. Correção já efetuada.",
      "Implementado"
    );

    // Ticket 78 (Resolvido)
    await runAtualizacao(78, 
      "Erro de Constraint e Rollback: A RPC tentava excluir os contatos secundários sem antes reatribuir tabelas filhas mais profundas (lançamentos, contratos, orçamentos, simulações). O banco ejetava e abortava a transação inteira.", 
      "Reescrita na íntegra a função 'merge_contacts_and_relink_all_references' para usar o sistema de Exception Atômica do Postgres. Agora as 13 tabelas relacionadas aos contatos têm suas foreign keys substituídas e o sistema continua a transferências se houver tabelas vazias, blindando o Rollback e matando o ticket.",
      "Implementado"
    );

    // Ticket 79 (Resolvido)
    await runAtualizacao(79, 
      "SaaS Migration Side-effect: A tabela individual 'usuario_preferencias_notificacao' foi removida na migração do módulo global. A página do usuário quebrou pois a query ainda apontava para lá.", 
      "Criada nova tabela individual chamada 'sys_user_notification_prefs'. Refatorado o front 'MinhasNotificacoes.js' para consultar uma nova RPC via Supabase RLS ('get_user_allowed_notifications') que compara o Cargo do funcionário logado com a array 'funcoes_ids' definidas pelo Administrador.",
      "Implementado"
    );
}

start();
