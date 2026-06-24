// scripts/auditoria-conversas-tres-dias.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== INICIANDO AUDITORIA DE CONVERSAS DOS ÚLTIMOS 3 DIAS ===');
  
  // Período de varredura: últimos 3 dias
  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
  const dataCorte = tresDiasAtras.toISOString();
  
  console.log(`Buscando mensagens recebidas a partir de: ${new Date(dataCorte).toLocaleString('pt-BR')}`);

  // 1. Buscar todas as mensagens de WhatsApp criadas nos últimos 3 dias
  const { data: mensagens, error: msgError } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, direction, created_at, content, status, error_message')
    .gte('created_at', dataCorte)
    .order('created_at', { ascending: false });

  if (msgError) {
    console.error('Erro ao buscar mensagens recentes:', msgError.message);
    process.exit(1);
  }

  console.log(`Encontradas ${mensagens.length} mensagens no período.`);

  // 2. Agrupar por contato_id único
  const contatosIdsUnicos = [...new Set(mensagens.map(m => m.contato_id))].filter(Boolean);
  console.log(`Total de contatos distintos com interação: ${contatosIdsUnicos.length}`);

  const auditoriaLeads = [];

  for (const contatoId of contatosIdsUnicos) {
    // Buscar o histórico completo do contato recente para entender a cronologia
    const { data: historico, error: histErr } = await supabase
      .from('whatsapp_messages')
      .select('id, content, direction, status, error_message, created_at')
      .eq('contato_id', contatoId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (histErr || !historico || historico.length === 0) continue;

    // Dados do contato
    const { data: contato } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, organizacao_id, created_at')
      .eq('id', contatoId)
      .maybeSingle();

    if (!contato) continue;

    // Buscar telefone do contato
    const { data: tel } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', contatoId)
      .limit(1)
      .maybeSingle();

    // Buscar corretor responsável no funil
    const { data: funil } = await supabase
      .from('contatos_no_funil')
      .select('corretor_id, coluna_id, colunas_funil(nome)')
      .eq('contato_id', contatoId)
      .limit(1)
      .maybeSingle();

    let corretorNome = 'Nenhum';
    let isStellaCorretor = false;
    
    if (funil?.corretor_id) {
      const { data: corrCont } = await supabase
        .from('contatos')
        .select('nome')
        .eq('id', funil.corretor_id)
        .maybeSingle();
      
      if (corrCont) {
        corretorNome = corrCont.nome;
        if (corrCont.nome.toLowerCase().includes('stella')) {
          isStellaCorretor = true;
        }
      }
    } else {
      isStellaCorretor = contato.ia_atendimento_ativo;
    }

    const ultimaMsg = historico[0];
    const ficouSemResposta = ultimaMsg.direction === 'inbound';
    
    // Ver se tem algum erro de webhook ou envio falho nas últimas mensagens
    const errosRecentes = historico.filter(m => m.status === 'failed').map(m => ({
      data: m.created_at,
      erro: m.error_message,
      conteudo: m.content
    }));

    auditoriaLeads.push({
      id: contatoId,
      nome: contato.nome,
      telefone: tel?.telefone || 'Não informado',
      ia_atendimento_ativo: contato.ia_atendimento_ativo,
      corretor_funil: corretorNome,
      is_stella_corretor: isStellaCorretor,
      coluna_funil: funil?.colunas_funil?.nome || 'Fora do Funil',
      ficou_sem_resposta: ficouSemResposta,
      ultima_mensagem: {
        direction: ultimaMsg.direction,
        data: ultimaMsg.created_at,
        content: ultimaMsg.content,
        status: ultimaMsg.status
      },
      erros_recentes: errosRecentes
    });
  }

  // Filtrar leads que deveriam ser respondidos pela Stella e não foram
  // Critério: Stella é responsável e ficou sem resposta
  const stellaIgnorados = auditoriaLeads.filter(l => l.ficou_sem_resposta && l.ia_atendimento_ativo);
  const outrosSemResposta = auditoriaLeads.filter(l => l.ficou_sem_resposta && !l.ia_atendimento_ativo);

  console.log(`\n=== LEADS SOB GESTÃO DA STELLA QUE FICARAM SEM RESPOSTA (${stellaIgnorados.length}) ===\n`);
  
  stellaIgnorados.forEach(lead => {
    console.log(`Lead: ${lead.nome} (ID: ${lead.id})`);
    console.log(` - Telefone: ${lead.telefone}`);
    console.log(` - Funil: ${lead.coluna_funil} | Corretor: ${lead.corretor_funil}`);
    console.log(` - Autopilot: ${lead.ia_atendimento_ativo ? 'Ativo ✅' : 'Inativo ❌'}`);
    console.log(` - Última mensagem do lead [${new Date(lead.ultima_mensagem.data).toLocaleString('pt-BR')}]: "${lead.ultima_mensagem.content}"`);
    if (lead.erros_recentes.length > 0) {
      console.log(` - 🚨 Erros de envio recentes:`);
      lead.erros_recentes.forEach(e => {
        console.log(`   * [${new Date(e.data).toLocaleString('pt-BR')}] "${e.erro}"`);
      });
    }
    console.log('----------------------------------------------------');
  });

  console.log(`\n=== OUTROS LEADS SEM RESPOSTA (HUMANO RESPONSÁVEL) (${outrosSemResposta.length}) ===\n`);
  outrosSemResposta.slice(0, 5).forEach(lead => {
    console.log(`Lead: ${lead.nome} (ID: ${lead.id})`);
    console.log(` - Telefone: ${lead.telefone}`);
    console.log(` - Corretor Funil: ${lead.corretor_funil} | Coluna: ${lead.coluna_funil}`);
    console.log(` - Última mensagem [${new Date(lead.ultima_mensagem.data).toLocaleString('pt-BR')}]: "${lead.ultima_mensagem.content}"`);
    console.log('----------------------------------------------------');
  });

  // Gravar relatório em markdown
  await gerarRelatorioMarkdown(stellaIgnorados, auditoriaLeads);
}

async function gerarRelatorioMarkdown(stellaIgnorados, todos) {
  const artifactDir = 'C:/Users/ranni/.gemini/antigravity/brain/f237ca8f-a0ef-4f82-9917-81955e800bb7';
  const filePath = path.join(artifactDir, 'auditoria_leads_recentes.md');

  let content = `# Relatório de Auditoria: Leads Não Respondidos nos Últimos 3 Dias\n\n`;
  content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
  content += `### Resumo Geral\n`;
  content += `| Métrica | Valor |\n`;
  content += `| :--- | :--- |\n`;
  content += `| **Contatos com interação recente** | **${todos.length}** |\n`;
  content += `| **Leads sob piloto Stella SEM RESPOSTA** | **${stellaIgnorados.length}** |\n`;
  content += `| **Leads humanos SEM RESPOSTA** | **${todos.filter(l => l.ficou_sem_resposta && !l.ia_atendimento_ativo).length}** |\n\n`;

  content += `## 🚨 1. Leads sob piloto da Stella Sem Resposta\n`;
  if (stellaIgnorados.length === 0) {
    content += `> [!NOTE]\n> Nenhum lead ativo sob piloto da Stella ficou sem resposta no período analisado.\n`;
  } else {
    content += `| ID | Nome do Lead | Telefone | Coluna Funil | Corretor Funil | Última Mensagem Cliente | Horário Inbound | Erros Recentes |\n`;
    content += `| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    
    for (const lead of stellaIgnorados) {
      const dataFormatada = new Date(lead.ultima_mensagem.data).toLocaleString('pt-BR');
      const conteudoLimpo = (lead.ultima_mensagem.content || '').replace(/\r?\n|\r/g, ' ').substring(0, 100);
      const erroStr = lead.erros_recentes.length > 0 
        ? lead.erros_recentes.map(e => `[${new Date(e.data).toLocaleTimeString('pt-BR')}] ${e.erro}`).join('<br>')
        : 'Nenhum';
      content += `| ${lead.id} | **${lead.nome}** | ${lead.telefone} | ${lead.coluna_funil} | ${lead.corretor_funil} | *"${conteudoLimpo}"* | ${dataFormatada} | ${erroStr} |\n`;
    }
  }

  content += `\n## 👥 2. Outros Leads Sem Resposta (Gestão Humana)\n`;
  const humanosSemRes = todos.filter(l => l.ficou_sem_resposta && !l.ia_atendimento_ativo);
  if (humanosSemRes.length === 0) {
    content += `> [!NOTE]\n> Nenhum lead sob gestão humana está aguardando resposta.\n`;
  } else {
    content += `| ID | Nome do Lead | Telefone | Coluna Funil | Corretor Funil | Última Mensagem Cliente | Horário Inbound |\n`;
    content += `| --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const lead of humanosSemRes) {
      const dataFormatada = new Date(lead.ultima_mensagem.data).toLocaleString('pt-BR');
      const conteudoLimpo = (lead.ultima_mensagem.content || '').replace(/\r?\n|\r/g, ' ').substring(0, 100);
      content += `| ${lead.id} | **${lead.nome}** | ${lead.telefone} | ${lead.coluna_funil} | ${lead.corretor_funil} | *"${conteudoLimpo}"* | ${dataFormatada} |\n`;
    }
  }

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\nRelatório de auditoria detalhado salvo em: ${filePath}`);
  } catch (err) {
    console.error('Erro ao gravar arquivo de relatório markdown:', err.message);
  }
}

run().catch(console.error);
