require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runAtualizacao(id, diagnostico, solucao) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  await client.query(
      "UPDATE feedback SET diagnostico = $1, plano_solucao = $2 WHERE id = $3", 
      [diagnostico, solucao, id]
  );
  console.log(`✅ Ticket #${id} atualizado com sucesso.`);
  await client.end();
}

async function main() {
  console.log('🤖 Devonildo iniciando triagem automática...\n');

  // -------------------------------------------
  // TICKET #55 — Imagem de Anexo Atrás da Tela
  // -------------------------------------------
  await runAtualizacao(
    55,
    `Bug de Z-Index no visualizador de anexos do módulo Financeiro. O componente 'FilePreviewPanel' dentro do 'LancamentoDetalhesSidebar.js' é renderizado com a classe CSS 'z-40', enquanto a sidebar principal utiliza 'z-[100]'. Isso faz com que o painel de visualização (imagens e PDFs) fique invisível — renderizado ATRÁS da própria sidebar que o invocou. O usuário clica no anexo, o painel abre mas não aparece pois está coberto pela própria sidebar.`,
    `Corrigir o z-index do 'FilePreviewPanel' no arquivo 'components/financeiro/LancamentoDetalhesSidebar.js'. O componente 'div' principal do painel (linha ~88) deve ter sua classe trocada de 'z-40' para 'z-[110]' ou 'z-[150]', garantindo que ele fique acima da sidebar (z-[100]) e do overlay de fundo (z-[90]). Adicionalmente, verificar se o overlay de fundo (backdrop) precisa ser ajustado para cobrir a sidebar também.`
  );

  // -------------------------------------------
  // TICKET #56 — Leads não chegam no Funil de Vendas Correto
  // -------------------------------------------
  await runAtualizacao(
    56,
    `Falha na lógica de roteamento de leads do Webhook do WhatsApp. O arquivo 'app/api/whatsapp/webhook/services/crm.js' ao criar um novo lead, busca o primeiro funil da organização ('funis' order by default, limit 1) e insere o lead na primeira coluna desse funil. Porém, o sistema já possui uma função de roteamento inteligente no banco de dados ('fn_rotear_lead') e regras na tabela 'regras_roteamento', que nunca são consultadas neste fluxo. O resultado é que todos os leads de WhatsApp vão sempre para a coluna 0 do funil 0, ignorando completamente as regras de distribuição entre corretores e funis configuradas pela equipe.`,
    `Refatorar o arquivo 'app/api/whatsapp/webhook/services/crm.js'. Na etapa de criação do contato no funil (após criar o contato e o telefone), substituir a lógica ingênua de 'primeiro funil + primeira coluna' por uma chamada à RPC 'fn_rotear_lead(p_contato_id, p_organizacao_id, p_origem)' passando a origem como 'whatsapp'. A função do banco já lida com toda a lógica de regras, distribuição round-robin e prioridades. Em caso de erro ou ausência de regras, o fallback atual (primeira coluna) pode ser mantido.`
  );

  // -------------------------------------------
  // TICKET #57 — Erro 404 Intermitente na Caixa de Entrada
  // -------------------------------------------
  await runAtualizacao(
    57,
    `Erro 404 intermitente na rota '/caixa-de-entrada'. A causa provável é uma combinação de fatores no Next.js App Router: (1) A página usa 'use client' mas não tem 'export const dynamic = force-dynamic', podendo gerar um cache de página estático na primeira renderização que invalida em certas condições. (2) O componente da página faz leitura de 'localStorage' dentro de um 'useEffect' com dependência em 'loading', o que pode causar uma race condition onde a página tenta renderizar antes das permissões estarem carregadas, resultando em um estado inconsistente que o App Router interpreta como rota inválida. (3) Em produção no Netlify, rotas do App Router podem sofrer um 'cold start' onde a função serverless não encontra a rota na primeira requisição.`,
    `Aplicar três correções no arquivo 'app/(main)/caixa-de-entrada/page.js': (1) Adicionar 'export const dynamic = force-dynamic' no topo do arquivo para desabilitar o cache estático desta rota. (2) Proteger a leitura do localStorage com um guard 'if (typeof window === undefined) return' antes do useEffect. (3) Garantir que o estado inicial de 'activeTab' seja definido server-side como null e só seja setado após o useEffect rodar no client, evitando a desidratação do React. Como medida adicional, verificar nos logs do Netlify se há erros de cold start para descartar problema de infraestrutura.`
  );

  // -------------------------------------------
  // TICKET #58 — Cronômetro de Janela WhatsApp Incorreto
  // -------------------------------------------
  await runAtualizacao(
    58,
    `Falha no controle e exibição do cronômetro de janela de 24h do WhatsApp Business. Investigação revelou que a tabela 'whatsapp_conversations' NÃO possui coluna dedicada para janela (ex: 'window_start_at', 'janela_aberta_ate'). O cronômetro é calculado com base no campo 'updated_at' da conversa, que é atualizado pelo webhook para QUALQUER evento — incluindo respostas da empresa. Isso significa que quando a empresa responde, o 'updated_at' é sobrescrito e a janela aparece como 'recém-aberta', mesmo que o cliente não tenha enviado mensagem há horas. Apenas mensagens RECEBIDAS (inbound) deveriam reiniciar o contador da janela de 24h da Meta.`,
    `Solução em duas etapas: (1) Adicionar coluna 'customer_window_start_at TIMESTAMPTZ' na tabela 'whatsapp_conversations' via migration SQL. (2) Modificar o arquivo 'app/api/whatsapp/webhook/services/crm.js' para, ao receber uma mensagem INBOUND (vinda do cliente), fazer upsert com 'customer_window_start_at = NOW()'. Mensagens OUTBOUND (enviadas pela empresa) NÃO devem atualizar este campo. (3) No front-end (componente de lista de conversas ou ContactProfile), exibir o cronômetro calculado como 'customer_window_start_at + 24h' em vez de usar 'updated_at'.`
  );

  console.log('\n🎉 Triagem concluída! Todos os tickets foram atualizados no banco de dados.');
}

main().catch(console.error);
