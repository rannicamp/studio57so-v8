// scratch/listar_leads_sem_nome.js
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
  console.log("=== EXTRATINDO TODOS OS LEADS SEM NOME IDENTIFICADO NA COLUNA 'EM ATENDIMENTO' ===");

  // 1. Buscar a coluna de "Em Atendimento"
  const { data: colunas, error: errCol } = await supabase
    .from('colunas_funil')
    .select('id, nome')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .ilike('nome', '%atendimento%');

  if (errCol || !colunas || colunas.length === 0) {
    console.error("Coluna 'Em Atendimento' não localizada!");
    return;
  }

  const colunaId = colunas[0].id;
  const nomeColuna = colunas[0].nome;

  // 2. Buscar contatos nessa coluna
  const { data: cards, error: errCards } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      created_at,
      contato_id,
      corretor_id,
      contatos!contatos_no_funil_contato_id_fkey(id, nome, ia_atendimento_ativo, created_at)
    `)
    .eq('coluna_id', colunaId)
    .eq('organizacao_id', ORGANIZACAO_ID);

  if (errCards) {
    console.error("Erro ao buscar cards no funil:", errCards.message);
    return;
  }

  // Filtrar apenas os contatos que começam com "Lead" no nome
  const cardsFiltrados = cards.filter(card => {
    const nome = card.contatos?.nome || '';
    return nome.startsWith('Lead');
  });

  console.log(`Cards com padrão 'Lead' na coluna: ${cardsFiltrados.length}`);

  const relatorioLeads = [];

  for (const card of cardsFiltrados) {
    const contato = card.contatos;
    
    // Buscar telefone
    const { data: telefones } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', contato.id)
      .limit(1);
    const telefone = telefones && telefones[0]?.telefone || 'Sem telefone';

    // Buscar a última mensagem trocada (sem limite de data!)
    const { data: ultimaMsg } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .eq('contato_id', contato.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let ultimaMsgTexto = 'Nenhuma mensagem registrada no WhatsApp';
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
      stella: contato.ia_atendimento_ativo ? 'Ativa' : 'Desativada',
      dias_inativo: diasInativo,
      quem_falou_ultimo: ultimaMsgDirecao ? (ultimaMsgDirecao === 'inbound' ? '👤 Lead' : '🏢 Empresa') : 'N/A',
      data_ultima_msg: ultimaMsgData ? ultimaMsgData.toLocaleString('pt-BR') : 'N/A',
      texto_ultima_msg: ultimaMsgTexto,
      card_criado_em: new Date(card.created_at).toLocaleString('pt-BR'),
      contato_criado_em: new Date(contato.created_at).toLocaleString('pt-BR')
    });
  }

  // Ordenar de acordo com a inatividade (do mais inativo ao mais recente)
  relatorioLeads.sort((a, b) => {
    if (a.dias_inativo === 'N/A') return 1;
    if (b.dias_inativo === 'N/A') return -1;
    return b.dias_inativo - a.dias_inativo;
  });

  gerarRelatorioMarkdown(relatorioLeads, cardsFiltrados.length);
}

function msgResumo(text) {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > 60 ? clean.substring(0, 60) + '...' : clean;
}

function gerarRelatorioMarkdown(leads, totalLeads) {
  const conversationId = '0254b46f-ded9-44e2-9d20-658a8e0cad55';
  const artifactsDir = `C:\\Users\\ranni\\.gemini\\antigravity\\brain\\${conversationId}`;
  
  let md = `# Relatório de Leads sem Nome na Coluna "Em Atendimento"\n\n`;
  md += `> [!NOTE]\n`;
  md += `> Este relatório lista todos os **${totalLeads} contatos** que possuem nomenclatura temporária ("Lead (telefone)") e que estão na coluna **Em Atendimento**.\n`;
  md += `> **Data de geração:** ${new Date().toLocaleString('pt-BR')}\n\n`;

  md += `## 📋 Listagem de Leads sem Nome (${totalLeads})\n\n`;
  md += `| Nome / Telefone | ID Contato | Criado Em | Dias Inativo | Último Contato Por | Data Último Contato | Conteúdo da Última Mensagem |\n`;
  md += `| :--- | :---: | :--- | :---: | :--- | :--- | :--- |\n`;

  leads.forEach(l => {
    const diasLabel = l.dias_inativo === 'N/A' ? 'Sem msgs' : (l.dias_inativo === 0 ? 'Hoje' : `${l.dias_inativo} dias`);
    md += `| **${l.nome}** | \`${l.contato_id}\` | ${l.contato_criado_em} | **${diasLabel}** | ${l.quem_falou_ultimo} | ${l.data_ultima_msg} | *"${l.texto_ultima_msg}"* |\n`;
  });

  md += `\n---\n\n## 💡 Análise do Devonildo\n`;
  md += `1. **Leads Sem Mensagens:** Leads onde consta "Sem msgs" são contatos que foram criados no banco de dados mas nunca trocaram mensagens via WhatsApp, ou cujos históricos de mensagens no canal foram apagados/limpos.\n`;
  md += `2. **Leads com Silêncio Comercial Prolongado:** Aqueles inativos há mais de 15 ou 30 dias representam contatos que pararam de responder há bastante tempo. Eles podem ser qualificados como perdidos se o follow-up não surtir efeito.\n`;
  md += `3. **Retomada de Contato:** Se você quiser resgatar algum lead específico dessa lista, recomendo que o corretor retome o papo ou utilize um template Meta de reativação.\n`;

  const filePath = path.join(artifactsDir, 'relatorio_leads_sem_nome.md');
  fs.writeFileSync(filePath, md, 'utf8');
  console.log(`Relatório de leads sem nome salvo com sucesso em: ${filePath}`);
}

main().catch(console.error);
