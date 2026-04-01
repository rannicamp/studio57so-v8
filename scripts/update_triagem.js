require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Ticket 84
  const diag84 = "O ExtratoManager.js atualmente busca as transações usando apenas o parâmetro do Mês completo. O sistema não permite delimitar um range de dias específicos localmente para recalcular as entradas, saídas e o saldo no período isolado.";
  const sol84 = "Adicionar seletores de Data Inicial e Data Final no cabeçalho do Extrato. Essas datas devem ser enviadas à query/API para que o banco traga o saldo consolidado apenas até a data inicial, e exiba/calcule os sub-totais apenas do intervalo de dias escolhido.";
  await supabase.from('feedback').update({ diagnostico: diag84, plano_solucao: sol84 }).eq('id', 84);

  // Ticket 85
  const diag85 = "O atributo 'link' cadastrado nas Notificações salvas do banco de dados (ex: '/crm/funil' ou caminhos desatualizados) está apontando para rotas que não existem mais na nova arquitetura App Router, gerando erro 404 ao usuário clicar pelo sininho.";
  const sol85 = "Rastrear o gatilho da API ou Webhook que gera as notificações e atualizar as URLs chumbadas (ex: trocar '/crm/funil' para '/crm'). Executar um UPDATE histórico na tabela 'notificacoes' corrigindo os 'links' corrompidos e unificar as rotas base do sistema.";
  await supabase.from('feedback').update({ diagnostico: diag85, plano_solucao: sol85 }).eq('id', 85);

  console.log("Atualização de triagem concluída usando supabase-js!");
}

runAtualizacao().catch(console.error);
