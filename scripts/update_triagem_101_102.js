require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runTriagemMultipla() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // TRIAGEM TICKET 101
  const diag101 = "Funcionalidade Ausente (Feature Request). O painel de Chat atual ('ChatInput.js' em 'components/whatsapp/panel') possui anexos para Imagem/Vídeo, Template e Localização, mas não possui a opção desenvolvida para selecionar e enviar um Contato (vCard) pela caixa de mensagens.";
  const sol101 = "Desenvolver o envio de Contatos: 1) Adicionar um novo botão 'Contato' no menu de clips do 'ChatInput.js'. 2) Criar um modal de busca na tabela 'contatos' para o usuário selecionar. 3) Integrar na rota '/api/whatsapp/send' o envio do tipo 'contacts' conforme a API do Meta/EvolutionAPI.";

  const { error: err1 } = await supabase.from('feedback')
    .update({ diagnostico: diag101, plano_solucao: sol101 })
    .eq('id', 101);

  if (err1) throw err1;

  // TRIAGEM TICKET 102
  const diag102 = "Funcionalidade Ausente (Feature Request). O módulo de Caixa de Entrada (WhatsApp Inbox) não possui integração nativa com o módulo de Vendas para consultar Tabela de Vendas, Condições Comerciais e Indexadores diretamente do chat e encaminhar aos clientes.";
  const sol102 = "Desenvolver Integração Tabela de Vendas no Inbox: 1) Adicionar um botão 'Tabela de Vendas' na barra lateral de perfil do lead ou como anexo. 2) Criar um Modal 'Tabela de Vendas Inbox' que consuma a tabela de unidades ('Simulador') e formate uma mensagem de proposta ou envie o PDF dinâmico da tabela do empreendimento diretamente no chat.";

  const { error: err2 } = await supabase.from('feedback')
    .update({ diagnostico: diag102, plano_solucao: sol102 })
    .eq('id', 102);
    
  if (err2) throw err2;

  console.log("Triagem dos tickets 101 e 102 gravada com sucesso.");
}

runTriagemMultipla().catch(e => console.error(e));
