// scratch/diagnosticar_coluna_entrada.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COLUNA_ENTRADA_ID = 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5';

async function main() {
  console.log("=== INICIANDO LEVANTAMENTO DA COLUNA ENTRADA ===");

  try {
    // 1. Buscar todos os contatos atualmente na coluna Entrada
    const { data: leadsFunil, error: errLf } = await supabase
      .from('contatos_no_funil')
      .select('id, contato_id, coluna_id, created_at')
      .eq('coluna_id', COLUNA_ENTRADA_ID);

    if (errLf) {
      console.error("Erro ao buscar leads no funil:", errLf.message);
      return;
    }

    console.log(`Quantidade de leads na coluna Entrada: ${leadsFunil.length}`);

    if (leadsFunil.length === 0) {
      console.log("Nenhum lead na coluna Entrada.");
      return;
    }

    const contatoIds = leadsFunil.map(l => l.contato_id);

    // 2. Buscar detalhes dos contatos
    const { data: contatos, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, created_at, organizacao_id')
      .in('id', contatoIds);

    if (errC) {
      console.error("Erro ao buscar contatos:", errC.message);
      return;
    }

    // Mapear contatos por ID
    const contatosMap = new Map(contatos.map(c => [c.id, c]));

    // 3. Buscar mensagens de WhatsApp para esses contatos
    const { data: mensagens, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('contato_id, direction, status, content, created_at, error_message')
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

    // 4. Analisar cada lead
    const analiseLeads = [];
    let countSemMensagens = 0;
    let countApenasInbound = 0; // última inbound
    let countOutboundComSucesso = 0; // última outbound enviada
    let countOutboundComFalha = 0; // última outbound falhou
    let statusIAAtiva = 0;
    let statusIADesativada = 0;

    leadsFunil.forEach(lf => {
      const contato = contatosMap.get(lf.contato_id);
      if (!contato) {
        analiseLeads.push({
          contato_id: lf.contato_id,
          nome: "Contato Não Encontrado no DB",
          data_entrada_funil: lf.created_at,
          situacao: "Sem dados cadastrais"
        });
        return;
      }

      if (contato.ia_atendimento_ativo) {
        statusIAAtiva++;
      } else {
        statusIADesativada++;
      }

      const msgs = mensagensPorContato.get(contato.id) || [];
      const totalMsgs = msgs.length;
      
      let situacao = "";
      let ultimaMsg = null;

      if (totalMsgs === 0) {
        situacao = "Sem mensagens trocadas";
        countSemMensagens++;
      } else {
        ultimaMsg = msgs[msgs.length - 1];
        if (ultimaMsg.direction === 'inbound') {
          situacao = "Sem resposta (Última mensagem enviada pelo cliente)";
          countApenasInbound++;
        } else if (ultimaMsg.direction === 'outbound') {
          if (ultimaMsg.status === 'failed') {
            situacao = `Falha no envio da última mensagem (Erro: ${ultimaMsg.error_message || 'Desconhecido'})`;
            countOutboundComFalha++;
          } else {
            situacao = `Mensagem enviada com sucesso (Status: ${ultimaMsg.status})`;
            countOutboundComSucesso++;
          }
        }
      }

      // Detalhar se teve mensagens enviadas (para entender se não foi movido)
      const temOutboundSucesso = msgs.some(m => m.direction === 'outbound' && m.status !== 'failed');

      analiseLeads.push({
        contato_id: contato.id,
        nome: contato.nome,
        organizacao_id: contato.organizacao_id,
        ia_atendimento_ativo: contato.ia_atendimento_ativo,
        data_cadastro: contato.created_at,
        data_entrada_funil: lf.created_at,
        total_mensagens: totalMsgs,
        tem_outbound_sucesso: temOutboundSucesso,
        situacao: situacao,
        ultima_mensagem: ultimaMsg ? {
          direction: ultimaMsg.direction,
          status: ultimaMsg.status,
          created_at: ultimaMsg.created_at,
          content: ultimaMsg.content ? (ultimaMsg.content.length > 50 ? ultimaMsg.content.substring(0, 50) + "..." : ultimaMsg.content) : null
        } : null
      });
    });

    // 5. Exibir sumário
    console.log("\n=== RESULTADO DO LEVANTAMENTO ===");
    console.log(`Total Analisado: ${analiseLeads.length} leads na coluna Entrada.`);
    console.log(`Sem mensagens trocadas: ${countSemMensagens}`);
    console.log(`Sem resposta (última mensagem do cliente): ${countApenasInbound}`);
    console.log(`Última mensagem enviada com sucesso (parado na Entrada): ${countOutboundComSucesso}`);
    console.log(`Última mensagem enviada com falha: ${countOutboundComFalha}`);
    console.log(`Piloto Automático Ativo (ia_atendimento_ativo = true): ${statusIAAtiva}`);
    console.log(`Piloto Automático Inativo (ia_atendimento_ativo = false): ${statusIADesativada}`);

    // Salvar relatório detalhado
    const reportData = {
      timestamp: new Date().toISOString(),
      totais: {
        total: analiseLeads.length,
        sem_mensagens: countSemMensagens,
        sem_resposta_cliente: countApenasInbound,
        outbound_sucesso_parado: countOutboundComSucesso,
        outbound_falha: countOutboundComFalha,
        ia_ativa: statusIAAtiva,
        ia_inativa: statusIADesativada
      },
      leads: analiseLeads
    };

    fs.writeFileSync('scratch/diagnostico_entrada.json', JSON.stringify(reportData, null, 2), 'utf-8');
    console.log("\nRelatório gerado em scratch/diagnostico_entrada.json");

    // Mostrar os primeiros 15 leads com problemas de cada tipo
    console.log("\n--- LEADS SEM MENSAGENS NO BANCO (Primeiros 5) ---");
    reportData.leads.filter(l => l.total_mensagens === 0).slice(0, 5).forEach(l => {
      console.log(`- ${l.nome} (ID: ${l.contato_id}) | Cadastrado em: ${l.data_cadastro}`);
    });

    console.log("\n--- LEADS SEM RESPOSTA DA IA (Última Inbound - Primeiros 5) ---");
    reportData.leads.filter(l => l.situacao.includes("Sem resposta")).slice(0, 5).forEach(l => {
      console.log(`- ${l.nome} (ID: ${l.contato_id}) | IA Ativa: ${l.ia_atendimento_ativo} | Última Msg: "${l.ultima_mensagem?.content}" às ${l.ultima_mensagem?.created_at}`);
    });

    console.log("\n--- LEADS COM FALHA DE ENVIO (Primeiros 5) ---");
    reportData.leads.filter(l => l.situacao.includes("Falha")).slice(0, 5).forEach(l => {
      console.log(`- ${l.nome} (ID: ${l.contato_id}) | IA Ativa: ${l.ia_atendimento_ativo} | Último Status: ${l.ultima_mensagem?.status} às ${l.ultima_mensagem?.created_at}`);
    });

    console.log("\n--- LEADS COM MENSAGEM ENVIADA MAS AINDA NA ENTRADA (Primeiros 5) ---");
    reportData.leads.filter(l => l.situacao.includes("sucesso")).slice(0, 5).forEach(l => {
      console.log(`- ${l.nome} (ID: ${l.contato_id}) | IA Ativa: ${l.ia_atendimento_ativo} | Total Msgs: ${l.total_mensagens} | Última: "${l.ultima_mensagem?.content}"`);
    });

  } catch (err) {
    console.error("Erro geral no script:", err);
  }
}

main();
