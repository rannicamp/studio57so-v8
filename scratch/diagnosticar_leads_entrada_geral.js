// scratch/diagnosticar_leads_entrada_geral.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vamos analisar as colunas de "ENTRADA" conhecidas no banco:
// 1. [902f7707-1f11-4fa6-89c3-b15735acfe1d] "ENTRADA" (Org 1 - Funil de Entrada) - 99 leads
// 2. [e8e88027-c7be-4e8c-9667-e17fa4e06ce5] "ENTRADA" (Org 1 - Funil de Vendas) - 4 leads
// 3. [db08dad2-49c6-4979-831e-285938e201ba] "ENTRADA" (Org 1 - Funil Geral Vanguard) - 0 leads

const COLUNAS_ENTRADA = [
  '902f7707-1f11-4fa6-89c3-b15735acfe1d',
  'e8e88027-c7be-4e8c-9667-e17fa4e06ce5',
  'db08dad2-49c6-4979-831e-285938e201ba'
];

async function main() {
  console.log("=== INICIANDO LEVANTAMENTO COMPLETO DE TODOS OS LEADS NA ENTRADA ===");

  try {
    // 1. Buscar todos os contatos_no_funil que estão em alguma coluna de entrada
    const { data: leadsFunil, error: errLf } = await supabase
      .from('contatos_no_funil')
      .select(`
        id, 
        contato_id, 
        coluna_id, 
        created_at,
        colunas_funil (
          nome,
          funil_id,
          organizacao_id,
          funis (
            nome
          )
        )
      `)
      .in('coluna_id', COLUNAS_ENTRADA);

    if (errLf) {
      console.error("Erro ao buscar leads no funil:", errLf.message);
      return;
    }

    console.log(`Total de leads encontrados nas colunas de Entrada: ${leadsFunil.length}`);

    if (leadsFunil.length === 0) {
      console.log("Nenhum lead nas colunas de Entrada.");
      return;
    }

    const contatoIds = leadsFunil.map(l => l.contato_id);

    // 2. Buscar dados detalhados de todos esses contatos
    const { data: contatos, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, created_at, organizacao_id')
      .in('id', contatoIds);

    if (errC) {
      console.error("Erro ao buscar contatos:", errC.message);
      return;
    }

    const contatosMap = new Map(contatos.map(c => [c.id, c]));

    // 3. Buscar mensagens de WhatsApp correspondentes a esses contatos
    const { data: mensagens, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('id, contato_id, direction, status, content, created_at, error_message, sender_id, receiver_id')
      .in('contato_id', contatoIds)
      .order('created_at', { ascending: true });

    if (errM) {
      console.error("Erro ao buscar mensagens:", errM.message);
      return;
    }

    // Agrupar mensagens por contato_id
    const mensagensPorContato = new Map();
    mensagens.forEach(msg => {
      if (!msg.contato_id) return;
      if (!mensagensPorContato.has(msg.contato_id)) {
        mensagensPorContato.set(msg.contato_id, []);
      }
      mensagensPorContato.get(msg.contato_id).push(msg);
    });

    // 4. Analisar e cruzar os dados
    const analise = [];
    
    leadsFunil.forEach(lf => {
      const contato = contatosMap.get(lf.contato_id);
      if (!contato) {
        analise.push({
          card_id: lf.id,
          contato_id: lf.contato_id,
          nome: "Contato sem dados no banco",
          ia_atendimento_ativo: false,
          data_cadastro: null,
          data_entrada_funil: lf.created_at,
          coluna_nome: lf.colunas_funil?.nome,
          funil_nome: lf.colunas_funil?.funis?.nome,
          organizacao_id: lf.colunas_funil?.organizacao_id,
          total_mensagens: 0,
          situacao: "Contato inexistente"
        });
        return;
      }

      const msgs = mensagensPorContato.get(contato.id) || [];
      const totalMsgs = msgs.length;
      
      const inboundMsgs = msgs.filter(m => m.direction === 'inbound');
      const outboundMsgs = msgs.filter(m => m.direction === 'outbound');
      const outboundSucesso = outboundMsgs.filter(m => m.status !== 'failed');
      const outboundFalhas = outboundMsgs.filter(m => m.status === 'failed');

      let situacao = "";
      if (totalMsgs === 0) {
        situacao = "Sem mensagens no banco";
      } else {
        const ultima = msgs[msgs.length - 1];
        if (ultima.direction === 'inbound') {
          situacao = "Aguardando resposta (Última mensagem é do cliente)";
        } else if (ultima.direction === 'outbound') {
          if (ultima.status === 'failed') {
            situacao = `Falha no envio da última mensagem (Erro: ${ultima.error_message || 'Sem erro cadastrado'})`;
          } else {
            situacao = `Respondido com sucesso (Última outbound status: ${ultima.status})`;
          }
        }
      }

      analise.push({
        card_id: lf.id,
        contato_id: contato.id,
        nome: contato.nome,
        ia_atendimento_ativo: contato.ia_atendimento_ativo,
        data_cadastro: contato.created_at,
        data_entrada_funil: lf.created_at,
        coluna_nome: lf.colunas_funil?.nome,
        funil_nome: lf.colunas_funil?.funis?.nome,
        coluna_id: lf.coluna_id,
        organizacao_id: contato.organizacao_id, // org real do contato
        coluna_organizacao_id: lf.colunas_funil?.organizacao_id, // org dona da coluna
        total_mensagens: totalMsgs,
        qtd_inbound: inboundMsgs.length,
        qtd_outbound_sucesso: outboundSucesso.length,
        qtd_outbound_falha: outboundFalhas.length,
        situacao: situacao,
        mensagens: msgs.map(m => ({
          direction: m.direction,
          status: m.status,
          created_at: m.created_at,
          content: m.content
        }))
      });
    });

    // 5. Categorizar os diagnósticos
    const semMensagens = analise.filter(a => a.total_mensagens === 0);
    const aguardandoResposta = analise.filter(a => a.situacao.includes("Aguardando resposta"));
    const falhaEnvio = analise.filter(a => a.situacao.includes("Falha"));
    const respondidosParados = analise.filter(a => a.situacao.includes("Respondido com sucesso"));

    console.log("\n=== CATEGORIZAÇÃO GERAL ===");
    console.log(`1. Total de Leads nas colunas de Entrada: ${analise.length}`);
    console.log(`2. Sem nenhuma mensagem no WhatsApp: ${semMensagens.length}`);
    console.log(`3. Aguardando Resposta (última foi inbound do cliente): ${aguardandoResposta.length}`);
    console.log(`4. Com Falha de Envio na última tentativa: ${falhaEnvio.length}`);
    console.log(`5. Respondidos com sucesso mas continuam na Entrada: ${respondidosParados.length}`);

    // Gerar um relatório detalhado em JSON e TXT
    fs.writeFileSync('scratch/diagnostico_entrada_geral.json', JSON.stringify(analise, null, 2), 'utf-8');

    let txtReport = "=== RELATÓRIO DE DIAGNÓSTICO DE LEADS NA COLUNA ENTRADA ===\n";
    txtReport += `Data de Execução: ${new Date().toISOString()}\n`;
    txtReport += `Total Analisado: ${analise.length} leads\n\n`;

    txtReport += "--------------------------------------------------------\n";
    txtReport += `CATEGORIA A: SEM NENHUMA MENSAGEM NO WHATSAPP (${semMensagens.length} leads)\n`;
    txtReport += "Estes leads estão cadastrados no funil mas não possuem registros de conversa.\n";
    txtReport += "--------------------------------------------------------\n";
    semMensagens.forEach((l, i) => {
      txtReport += `${i+1}. Nome: ${l.nome} (ID: ${l.contato_id}) | Funil: ${l.funil_nome} | Org Contato: ${l.organizacao_id} | Cadastrado em: ${l.data_cadastro}\n`;
    });

    txtReport += "\n--------------------------------------------------------\n";
    txtReport += `CATEGORIA B: AGUARDANDO RESPOSTA (${aguardandoResposta.length} leads)\n`;
    txtReport += "Estes contatos enviaram mensagens, mas a última mensagem da conversa é do cliente. A Stella ou o corretor humano não responderam.\n";
    txtReport += "--------------------------------------------------------\n";
    aguardandoResposta.forEach((l, i) => {
      const ultima = l.mensagens[l.mensagens.length - 1];
      txtReport += `${i+1}. Nome: ${l.nome} (ID: ${l.contato_id}) | Piloto Ativo: ${l.ia_atendimento_ativo} | Org Contato: ${l.organizacao_id}\n`;
      txtReport += `   Última mensagem do cliente (${ultima.created_at}): "${ultima.content}"\n`;
    });

    txtReport += "\n--------------------------------------------------------\n";
    txtReport += `CATEGORIA C: FALHA DE ENVIO (${falhaEnvio.length} leads)\n`;
    txtReport += "Tentativas de enviar mensagem para estes leads falharam (Meta WhatsApp API error).\n";
    txtReport += "--------------------------------------------------------\n";
    falhaEnvio.forEach((l, i) => {
      const ultima = l.mensagens[l.mensagens.length - 1];
      txtReport += `${i+1}. Nome: ${l.nome} (ID: ${l.contato_id}) | Piloto Ativo: ${l.ia_atendimento_ativo} | Org: ${l.organizacao_id}\n`;
      txtReport += `   Data da Falha: ${ultima.created_at} | Status: ${ultima.status}\n`;
      txtReport += `   Texto que falhou: "${ultima.content ? ultima.content.substring(0, 100) : ''}"\n`;
    });

    txtReport += "\n--------------------------------------------------------\n";
    txtReport += `CATEGORIA D: RESPONDIDOS COM SUCESSO MAS PARADOS NA ENTRADA (${respondidosParados.length} leads)\n`;
    txtReport += "Estes leads já receberam resposta com sucesso, mas a coluna no funil não foi atualizada para \"MENSAGEM ENVIADA\" ou outra posterior.\n";
    txtReport += "--------------------------------------------------------\n";
    respondidosParados.forEach((l, i) => {
      const ultima = l.mensagens[l.mensagens.length - 1];
      txtReport += `${i+1}. Nome: ${l.nome} (ID: ${l.contato_id}) | Piloto Ativo: ${l.ia_atendimento_ativo} | Org: ${l.organizacao_id} | Total Msgs: ${l.total_mensagens}\n`;
      txtReport += `   Última outbound com sucesso (${ultima.created_at}): "${ultima.content ? ultima.content.substring(0, 80) + '...' : ''}"\n`;
    });

    fs.writeFileSync('scratch/relatorio_diagnostico_entrada.txt', txtReport, 'utf-8');
    console.log("Relatório gerado em scratch/relatorio_diagnostico_entrada.txt");

  } catch (err) {
    console.error("Erro crítico:", err);
  }
}

main();
