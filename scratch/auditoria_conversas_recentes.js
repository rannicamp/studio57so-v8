// scratch/auditoria_conversas_recentes.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ontem às 16h em fuso -03:00 é 19:00:00 UTC
const DATA_INICIO_UTC = '2026-06-25T19:00:00.000Z';

async function main() {
  console.log("=== INICIANDO AUDITORIA DE CONVERSAS RECENTES (DESDE ONTEM ÀS 16h) ===");
  
  let report = "=== RELATÓRIO DE AUDITORIA DE CONVERSAS RECENTES ===\n";
  report += `Período: de 25/06/2026 16:00 até 26/06/2026 08:45 (Fuso local)\n`;
  report += `Executado em: ${new Date().toISOString()}\n\n`;

  function log(msg) {
    console.log(msg);
    report += msg + "\n";
  }

  try {
    // 1. Buscar mensagens
    const { data: messages, error: errMsgs } = await supabase
      .from('whatsapp_messages')
      .select('contato_id, content, direction, created_at, status, error_message')
      .eq('organizacao_id', 2)
      .gte('created_at', DATA_INICIO_UTC)
      .order('created_at', { ascending: true });

    if (errMsgs) {
      log(`Erro ao buscar mensagens: ${errMsgs.message}`);
      return;
    }

    log(`Total de mensagens trafegadas no período: ${messages.length}`);

    // Agrupar mensagens por contato_id
    const contatosMensagens = new Map();
    messages.forEach(msg => {
      if (!msg.contato_id) return;
      if (!contatosMensagens.has(msg.contato_id)) {
        contatosMensagens.set(msg.contato_id, []);
      }
      contatosMensagens.get(msg.contato_id).push(msg);
    });

    log(`Total de contatos ativos no período: ${contatosMensagens.size}\n`);

    const contatosIds = Array.from(contatosMensagens.keys());
    if (contatosIds.length === 0) {
      log("Nenhuma mensagem de WhatsApp trocada no período informado.");
      fs.writeFileSync('scratch/relatorio_conversas_recentes.txt', report, 'utf-8');
      return;
    }

    // 2. Buscar contatos e colunas do funil
    const { data: contatosData, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, origem')
      .in('id', contatosIds);

    if (errC) {
      log(`Erro ao buscar dados dos contatos: ${errC.message}`);
      return;
    }

    const { data: funilData } = await supabase
      .from('contatos_no_funil')
      .select(`
        contato_id,
        colunas_funil (
          nome
        )
      `)
      .in('contato_id', contatosIds);

    const contatosMap = new Map(contatosData.map(c => [c.id, c]));
    const funilMap = new Map((funilData || []).map(f => [f.contato_id, f]));

    // 3. Detalhar conversa por conversa
    let index = 1;
    for (const [contatoId, msgs] of contatosMensagens.entries()) {
      const contato = contatosMap.get(contatoId);
      const funil = funilMap.get(contatoId);
      
      if (!contato) continue;

      log(`======================================================================`);
      log(`${index}. Lead: ${contato.nome} (ID: ${contatoId})`);
      log(`   Coluna CRM: ${funil?.colunas_funil?.nome || 'Inbox / Sem Coluna'}`);
      log(`   Piloto Automático: ${contato.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}`);
      log(`   Origem: ${contato.origem || 'N/A'}`);
      log(`   Mensagens trocadas no período: ${msgs.length}`);
      log(`----------------------------------------------------------------------`);

      msgs.forEach(m => {
        const timestampLocal = new Date(m.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const emissor = m.direction === 'inbound' ? 'CLIENTE' : 'STELLA / SISTEMA 🤖';
        const statusMsg = m.direction === 'outbound' ? `[Status: ${m.status}${m.error_message ? ' - Erro: ' + m.error_message : ''}]` : '';
        log(`   [${timestampLocal}] [${emissor}] ${statusMsg}`);
        log(`   "${m.content.trim()}"`);
        log("");
      });
      
      index++;
    }

    fs.writeFileSync('scratch/relatorio_conversas_recentes.txt', report, 'utf-8');
    log(`======================================================================`);
    log("Relatório salvo com sucesso em scratch/relatorio_conversas_recentes.txt!");

  } catch (err) {
    log(`Erro crítico ao rodar auditoria: ${err.message}`);
  }
}

main();
