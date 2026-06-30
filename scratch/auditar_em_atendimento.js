// scratch/auditar_em_atendimento.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ORGANIZACAO_ID = 2; // STUDIO 57

async function main() {
  console.log("=== INICIANDO AUDITORIA DA COLUNA 'EM ATENDIMENTO' ===");

  // 1. Buscar a coluna de "Em Atendimento"
  const { data: colunas, error: errCol } = await supabase
    .from('colunas_funil')
    .select('id, nome')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .ilike('nome', '%atendimento%');

  if (errCol) {
    console.error("Erro ao buscar colunas do funil:", errCol.message);
    return;
  }

  console.log("Colunas encontradas:");
  console.table(colunas);

  if (!colunas || colunas.length === 0) {
    console.error("Coluna 'Em Atendimento' não localizada no funil comercial!");
    return;
  }

  const colunaId = colunas[0].id;
  const nomeColuna = colunas[0].nome;
  console.log(`\nAuditando a coluna: "${nomeColuna}" (ID: ${colunaId})`);

  // 2. Buscar contatos nessa coluna
  const { data: cards, error: errCards } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      created_at,
      updated_at,
      contato_id,
      corretor_id,
      contatos!contatos_no_funil_contato_id_fkey(id, nome, ia_atendimento_ativo)
    `)
    .eq('coluna_id', colunaId)
    .eq('organizacao_id', ORGANIZACAO_ID);

  if (errCards) {
    console.error("Erro ao buscar cards no funil:", errCards.message);
    return;
  }

  console.log(`Cards ativos nesta coluna: ${cards?.length || 0}`);

  if (!cards || cards.length === 0) {
    console.log("Nenhum lead parado nesta coluna.");
    return;
  }

  const relatorioLeads = [];

  for (const card of cards) {
    const contato = card.contatos;
    if (!contato) continue;

    // Buscar telefone
    const { data: telefones } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', contato.id)
      .limit(1);
    const telefone = telefones && telefones[0]?.telefone || 'Sem telefone';

    // Buscar corretor responsável
    let nomeCorretor = 'Não atribuído';
    if (card.corretor_id) {
      const { data: corretor } = await supabase
        .from('contatos')
        .select('nome')
        .eq('id', card.corretor_id)
        .maybeSingle();
      if (corretor) nomeCorretor = corretor.nome;
    }

    // Buscar a última mensagem trocada
    const { data: ultimaMsg, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .eq('contato_id', contato.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let ultimaMsgTexto = 'Nenhuma mensagem registrada';
    let ultimaMsgData = null;
    let ultimaMsgDirecao = null;
    let diasInativo = 'N/A';

    if (ultimaMsg) {
      ultimaMsgTexto = msgResumo(ultimaMsg.content);
      ultimaMsgData = new Date(ultimaMsg.created_at);
      ultimaMsgDirecao = ultimaMsg.direction;

      const diffMs = Date.now() - ultimaMsgData.getTime();
      diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    relatorioLeads.push({
      contato_id: contato.id,
      nome: contato.nome,
      telefone: telefone,
      corretor: nomeCorretor,
      stella: contato.ia_atendimento_ativo ? 'Ativa' : 'Desativada',
      dias_inativo: diasInativo,
      quem_falou_ultimo: ultimaMsgDirecao === 'inbound' ? '👤 Lead' : '🏢 Empresa',
      data_ultima_msg: ultimaMsgData ? ultimaMsgData.toLocaleString('pt-BR') : 'N/A',
      texto_ultima_msg: ultimaMsgTexto,
      card_criado_em: new Date(card.created_at).toLocaleString('pt-BR')
    });
  }

  // Ordenar pelos mais antigos (dias_inativo desc)
  relatorioLeads.sort((a, b) => {
    if (a.dias_inativo === 'N/A') return 1;
    if (b.dias_inativo === 'N/A') return -1;
    return b.dias_inativo - a.dias_inativo;
  });

  console.log("\n========================================================================");
  console.log(`RELATÓRIO DE INATIVIDADE NA COLUNA "${nomeColuna.toUpperCase()}"`);
  console.log("========================================================================");
  console.table(relatorioLeads.map(l => ({
    Lead: l.nome,
    Corretor: l.corretor,
    "Dias Sem Falar": l.dias_inativo,
    "Quem Mandou Última": l.quem_falou_ultimo,
    "Último Contato": l.data_ultima_msg,
    "Mensagem": l.texto_ultima_msg
  })));
  console.log("========================================================================");

  // Gerar relatório em markdown também para salvarmos no scratch
  gerarRelatorioMarkdown(relatorioLeads, nomeColuna);
}

function msgResumo(text) {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > 50 ? clean.substring(0, 50) + '...' : clean;
}

function gerarRelatorioMarkdown(leads, nomeColuna) {
  const conversationId = '0254b46f-ded9-44e2-9d20-658a8e0cad55';
  const artifactsDir = `C:\\Users\\ranni\\.gemini\\antigravity\\brain\\${conversationId}`;
  
  let md = `# Relatório de Auditoria: Leads Parados em "${nomeColuna}"\n\n`;
  md += `> [!WARNING]\n`;
  md += `> Este relatório lista todos os cards na coluna **${nomeColuna}** ordenados por tempo de inatividade comercial.\n`;
  md += `> **Data de extração:** ${new Date().toLocaleString('pt-BR')}\n\n`;

  md += `## 📋 Leads na Coluna e Tempo de Silêncio\n\n`;
  md += `| Lead (ID) | Corretor Responsável | Dias Inativo | Última Mensagem Por | Data do Último Contato | Última Mensagem Trocada |\n`;
  md += `| :--- | :--- | :---: | :--- | :--- | :--- |\n`;

  leads.forEach(l => {
    const diasLabel = l.dias_inativo === 0 ? 'Hoje' : `${l.dias_inativo} dias`;
    md += `| **${l.nome}** (\`${l.contato_id}\`) | ${l.corretor} | **${diasLabel}** | ${l.quem_falou_ultimo} | ${l.data_ultima_msg} | *"${l.texto_ultima_msg}"* |\n`;
  });

  md += `\n---\n\n## 🛠️ Recomendações e Ações Comerciais\n\n`;

  leads.forEach(l => {
    md += `### 👤 ${l.info?.nome || l.nome} (\`${l.contato_id}\`)\n`;
    md += `* **Telefone:** \`${l.telefone}\` | **Responsável:** \`${l.corretor}\` | **Silêncio há:** \`${l.dias_inativo} dias\`\n`;
    md += `* **Último contato em:** \`${l.data_ultima_msg}\` enviado por \`${l.quem_falou_ultimo}\`\n`;

    // Lógica de recomendação baseada no silêncio e em quem mandou por último
    let recomendacao = '';
    if (l.dias_inativo === 'N/A' || l.dias_inativo > 30) {
      recomendacao = `⚠️ **Mover para PERDIDO:** Lead sem contato recente ou parado há mais de um mês.`;
    } else if (l.quem_falou_ultimo === '👤 Lead') {
      recomendacao = `🚨 **GARGALO NO ATENDIMENTO:** O cliente mandou a última mensagem e está aguardando resposta do corretor há ${l.dias_inativo} dias. Cobrar resposta imediata de **${l.corretor}**.`;
    } else {
      if (l.dias_inativo > 7) {
        recomendacao = `⏱️ **Fazer Follow-up de Reativação:** O corretor mandou a última mensagem e o lead não responde há ${l.dias_inativo} dias. Sugerir que o corretor tente um contato ou template de acompanhamento, ou arquive como Perdido.`;
      } else {
        recomendacao = `👍 **Em andamento recente:** Conversa dentro do fluxo comercial normal das últimas semanas. Acompanhar evolução.`;
      }
    }

    md += `* **Ação Sugerida:** ${recomendacao}\n\n`;
  });

  const filePath = path.join(artifactsDir, 'relatorio_leads_parados.md');
  fs.writeFileSync(filePath, md, 'utf8');
  console.log(`Relatório salvo com sucesso em markdown em: ${filePath}`);
}

main().catch(console.error);
