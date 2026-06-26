// scratch/auditoria_leads_sem_resposta.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== INICIANDO AUDITORIA DE LEADS E VARREDURA DE ATENDIMENTO ===");
  
  let report = "=== RELATÓRIO DE AUDITORIA DE LEADS E VARREDURA DE ATENDIMENTO ===\n";
  report += `Executado em: ${new Date().toISOString()}\n\n`;

  function log(msg) {
    console.log(msg);
    report += msg + "\n";
  }

  try {
    // 1. Buscar todas as mensagens criadas a partir de 21/06/2026 para a Org 2
    const { data: messages, error: errMsgs } = await supabase
      .from('whatsapp_messages')
      .select('contato_id, content, direction, created_at, status, error_message')
      .eq('organizacao_id', 2)
      .gte('created_at', '2026-06-21T00:00:00.000Z')
      .order('created_at', { ascending: true });

    if (errMsgs) {
      log(`Erro ao buscar mensagens: ${errMsgs.message}`);
      return;
    }

    log(`Total de mensagens trafegadas nesta semana: ${messages.length}`);

    // Agrupar mensagens por contato_id para encontrar a última de cada conversa
    const conversasMap = new Map();
    messages.forEach(msg => {
      if (!msg.contato_id) return;
      conversasMap.set(msg.contato_id, msg);
    });

    log(`Total de contatos ativos na semana: ${conversasMap.size}`);

    // Separar em categorias: Sem Resposta (última inbound) e Falha de Envio (última outbound com falha)
    const contatosIds = Array.from(conversasMap.keys());
    if (contatosIds.length === 0) {
      log("Nenhuma mensagem de WhatsApp trocada esta semana.");
      return;
    }

    // Buscar dados dos contatos e do funil em lote para ser rápido
    const { data: contatosData, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo')
      .in('id', contatosIds);

    if (errC) {
      log(`Erro ao buscar dados dos contatos: ${errC.message}`);
      return;
    }

    const { data: funilData, error: errF } = await supabase
      .from('contatos_no_funil')
      .select(`
        contato_id,
        coluna_id,
        colunas_funil (
          nome
        )
      `)
      .in('contato_id', contatosIds);

    if (errF) {
      log(`Erro ao buscar dados do funil: ${errF.message}`);
      return;
    }

    // Criar dicionários para acesso rápido
    const contatosMap = new Map(contatosData.map(c => [c.id, c]));
    const funilMap = new Map(funilData.map(f => [f.contato_id, f]));

    const semResposta = [];
    const falhaEnvio = [];
    const bemAtendidos = [];

    conversasMap.forEach((ultimaMsg, contatoId) => {
      const contato = contatosMap.get(contatoId);
      const funil = funilMap.get(contatoId);
      
      if (!contato) return;

      const leadInfo = {
        id: contatoId,
        nome: contato.nome,
        ia_atendimento_ativo: contato.ia_atendimento_ativo,
        coluna: funil?.colunas_funil?.nome || 'Sem coluna / Inbox',
        ultimaMsg: ultimaMsg
      };

      if (ultimaMsg.direction === 'inbound') {
        semResposta.push(leadInfo);
      } else if (ultimaMsg.direction === 'outbound' && ultimaMsg.status === 'failed') {
        falhaEnvio.push(leadInfo);
      } else {
        bemAtendidos.push(leadInfo);
      }
    });

    log(`\n🚨 LEADS SEM RESPOSTA (Última mensagem enviada pelo cliente): ${semResposta.length}`);
    semResposta.forEach((r, index) => {
      log(`${index + 1}. Contato: ${r.nome} (ID: ${r.id})`);
      log(`   Coluna CRM: ${r.coluna}`);
      log(`   Piloto Automático: ${r.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}`);
      log(`   Data da Mensagem: ${r.ultimaMsg.created_at}`);
      log(`   Conteúdo recebido: "${r.ultimaMsg.content}"`);
      log("-".repeat(60));
    });

    log(`\n⚠️ LEADS COM FALHA DE ENVIO (Tentativa de resposta falhou): ${falhaEnvio.length}`);
    falhaEnvio.forEach((r, index) => {
      log(`${index + 1}. Contato: ${r.nome} (ID: ${r.id})`);
      log(`   Coluna CRM: ${r.coluna}`);
      log(`   Piloto Automático: ${r.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}`);
      log(`   Data da Falha: ${r.ultimaMsg.created_at}`);
      log(`   Último Status: ${r.ultimaMsg.status} (Erro: ${r.ultimaMsg.error_message || 'Nenhum listado'})`);
      log(`   Texto que falhou: "${r.ultimaMsg.content}"`);
      log("-".repeat(60));
    });

    log(`\n🟢 LEADS BEM ATENDIDOS (Última mensagem é nossa ou enviada com sucesso): ${bemAtendidos.length}`);
    bemAtendidos.forEach((r, index) => {
      log(`${index + 1}. Contato: ${r.nome} (ID: ${r.id})`);
      log(`   Coluna CRM: ${r.coluna}`);
      log(`   Piloto Automático: ${r.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}`);
      log(`   Data: ${r.ultimaMsg.created_at}`);
      log(`   Última Mensagem: "${r.ultimaMsg.content.substring(0, 80)}..."`);
      log("-".repeat(60));
    });

    // Escrever o relatório
    fs.writeFileSync('scratch/relatorio_varredura_leads.txt', report, 'utf-8');
    log("\nRelatório gerado com sucesso em scratch/relatorio_varredura_leads.txt!");

  } catch (err) {
    log(`Erro crítico na auditoria: ${err.message}`);
  }
}

main();
