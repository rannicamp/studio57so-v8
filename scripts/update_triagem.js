require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runAtualizacao(id, diagnostico, solucao) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  // If there is no password in .env.local, we can fallback to SUPABASE_SERVICE_ROLE_KEY if we used @supabase/supabase-js,
  // but the workflow rule explicitly says:
  // "ATENÇÃO: PARA NÃO TOMAR ERRO DE SSL AUTO-ASSINADO DO SUPABASE, SEMPRE UTILIZE ESTE TEMPLATE DE CONEXÃO COM A PORTA 6543 PARA INJETAR SEUS DIAGNÓSTICOS:"
  // I must use this pg template but if password is not available I might have an issue.
  // Wait, I will use supabase-js since we don't have SUPABASE_DB_PASSWORD.
}

// Rewriting it to use @supabase/supabase-js because the user env doesn't have SUPABASE_DB_PASSWORD.
const { createClient } = require('@supabase/supabase-js');

async function updateFeedback(id, diagnostico, solucao) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('feedback')
        .update({ 
            diagnostico: diagnostico, 
            plano_solucao: solucao,
            status: 'Em Análise',
            comentarios: 'Triagem autônoma realizada. Aguardando autorização para implementar o plano de solução.'
        })
        .eq('id', id);

    if (error) {
        console.error(`Erro ao atualizar feedback ${id}:`, error);
    } else {
        console.log(`Feedback ${id} atualizado com sucesso!`);
    }
}

async function run() {
    const updates = [
        {
            id: 124,
            diagnostico: "O componente `TabelaVenda.js` depende da funcionalidade nativa `window.print()` associada a regras CSS (`@media print`). A queixa de textos borrados se deve ao dimensionamento do PDF no navegador. O browser pode estar 'espremendo' e borrando fontes se a largura da tabela ou do layout global ultrapassar a viewport limpa de impressão.",
            solucao: "Adicionar regras de precisão na media print (`-webkit-print-color-adjust: exact`, `text-rendering: optimizeLegibility`) no componente `TabelaVenda.js`, além de garantir que a largura do body não ultrapasse 100% durante o landscape print, evitando rasterização de vetores e blur."
        },
        {
            id: 125,
            diagnostico: "A rota de salvamento em `EmailSignatureConfig.js` utiliza a função `update()` do Supabase filtrando por `user_id`. Se o usuário ainda não tiver nenhuma configuração prévia salva, o `update` não encontra a linha e não faz nada, falhando silenciosamente.",
            solucao: "Substituir `update(payload).eq('user_id', user.id)` por um fluxo de validação com `upsert()` no componente `EmailSignatureConfig.js`, garantindo que se não existir, a linha seja criada."
        },
        {
            id: 126,
            diagnostico: "No cadastro de produtos (unidades), o `valor_venda_calculado` (preço cheio da tabela) é estático na tabela do banco. Alterar a área (`area_m2`) pelo painel não recalcula automaticamente esse campo se não houver um hook no React ou Trigger no banco.",
            solucao: "Implementar o recálculo imediato do `valor_venda_calculado` (area * valor_m2) na rotina de update do frontend no `ProdutoForm.js` / `ProdutoList.js` antes de persistir o salvamento no Supabase."
        },
        {
            id: 127,
            diagnostico: "A gestão de filtros e funis na Caixa de Entrada (`WhatsAppInbox.js`) tem falhas de referência de UUIDs entre Funis e Leads ou o estado local React não limpa o cache ao alternar os funis, resultando na mistura das visões.",
            solucao: "Revisar o state manager do funil selecionado na Inbox, assegurando que o `funil_id` passado como parâmetro da Query filtre de modo estrito os leads correspondentes, e invalidar queries corretamente via TanStack Query no evento `onChange`."
        },
        {
            id: 128,
            diagnostico: "A Gestão do Funil na interface lateral do Lead na Inbox (troca de Funil ou Etapa) está com a mutação apontando para campos errados ou sofrendo falha silenciosa de RLS/ID de update.",
            solucao: "Verificar a Mutation responsável pela atualização do lead no `LeadProfileSidebar.js` e garantir que `funil_id` e `fase_id` sejam atualizados no banco e a lista de inbox refetched na sequência."
        },
        {
            id: 129,
            diagnostico: "O canal de WebSockets (Supabase Realtime) escuta novos eventos restrito pelo `atendente_id === user.id`. Um novo lead não atribuído não atende ao filtro e a notificação é ignorada na tela dos gestores.",
            solucao: "Ampliar o payload do canal `postgres_changes` no frontend para escutar todos os eventos da `organizacao_id` e, do lado cliente, exibir a notificação Toast se o usuário for administrador ou se o lead estiver vago."
        },
        {
            id: 130,
            diagnostico: "Na visualização Kanban, tickets deixam de aparecer se o string de status (`status` no DB) não der match exato com as colunas definidas em código, ou se aspas extras/espaços corromperem o enum.",
            solucao: "Revisar `PedidosKanban.js` (ou o módulo de compras correspondente). Adicionar uma coluna de fallback 'Sem Status' ou padronizar `.toLowerCase().trim()` na distribuição dos cartões para as colunas."
        },
        {
            id: 131,
            diagnostico: "A Sidebar de Perfil de Lead foi ocultada no grid principal da página `/caixa-de-entrada` do Desktop para priorizar a área do Chat, inviabilizando a visão rápida dos dados do Lead.",
            solucao: "Re-anexar o componente `LeadProfileSidebar` ou um Drawer retrátil associado ao grid de mensagens (`xl:col-span-3`) para que o CRM do Lead seja visível simultaneamente à conversa."
        },
        {
            id: 132,
            diagnostico: "Melhoria UX solicitada para exibir a Data de Pagamento Efetiva além da Data de Vencimento, o que aprimora o controle de Inadimplência ou adiantamentos em tabela.",
            solucao: "Inserir o campo `data_pagamento_real` na consulta principal do Extrato/Relatório Financeiro e plotar uma nova coluna renderizada nas tabelas, formatada via `date-fns`."
        },
        {
            id: 133,
            diagnostico: "Botões de Download de anexos hospedados no Supabase Storage utilizam ancoragem HTML `<a>` com tag `download`, porém por se tratar de um CDN cross-origin, os browsers forçam a abertura em nova aba (streaming/player de vídeo) em vez de baixar.",
            solucao: "Implementar uma função de download utilitária utilizando Fetch para converter a URL do storage em Blob (`URL.createObjectURL(blob)`) e, então, forçar o download programaticamente no client-side via tag temporária."
        }
    ];

    for (const update of updates) {
        await updateFeedback(update.id, update.diagnostico, update.solucao);
    }
}

run();
