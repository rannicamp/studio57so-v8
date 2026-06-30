// .agents/skills/relatorio_conversas/scripts/gerar_relatorio_rico.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const conversationId = '0254b46f-ded9-44e2-9d20-658a8e0cad55';
const artifactsDir = `C:\\Users\\ranni\\.gemini\\antigravity\\brain\\${conversationId}\\scratch`;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos em .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parsear argumento de horas
function getHoursArg() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--horas' && argv[i + 1]) {
      return parseInt(argv[i + 1], 10);
    }
  }
  return null;
}

async function main() {
  console.log("=== INICIANDO GERAÇÃO DE RELATÓRIO RICO DE CONVERSAS ===");

  // 1. Definir o corte de tempo
  const horasArg = getHoursArg();
  let dataCorteISO;
  let labelPeriodo;

  if (horasArg) {
    const dataCorte = new Date(Date.now() - horasArg * 60 * 60 * 1000);
    dataCorteISO = dataCorte.toISOString();
    labelPeriodo = `Últimas ${horasArg} horas (desde ${dataCorte.toLocaleString('pt-BR')})`;
  } else {
    // Padrão: Ontem 29/06/2026 às 12:00 BRT = 15:00 UTC
    dataCorteISO = '2026-06-29T15:00:00.000Z';
    labelPeriodo = `Desde ontem 12h BRT (${new Date(dataCorteISO).toLocaleString('pt-BR')})`;
  }

  console.log(`Corte temporal: ${labelPeriodo}`);

  // 2. Buscar todas as mensagens recentes
  const { data: mensagens, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('contato_id, direction, created_at, content')
    .gte('created_at', dataCorteISO)
    .order('created_at', { ascending: false });

  if (errM) {
    console.error("Erro ao carregar mensagens:", errM.message);
    return;
  }

  console.log(`Mensagens encontradas: ${mensagens?.length || 0}`);

  if (!mensagens || mensagens.length === 0) {
    console.log("Nenhuma conversa ativa no período.");
    return;
  }

  // 3. Agrupar contatos ativos
  const contatosAtivos = {};
  mensagens.forEach(msg => {
    const cid = msg.contato_id;
    if (!cid) return;

    if (!contatosAtivos[cid]) {
      contatosAtivos[cid] = {
        id: cid,
        mensagens_inbound: 0,
        mensagens_outbound: 0,
        mensagens_recentes: []
      };
    }

    if (msg.direction === 'inbound') {
      contatosAtivos[cid].mensagens_inbound++;
    } else {
      contatosAtivos[cid].mensagens_outbound++;
    }

    // Armazenar as últimas 5 mensagens
    if (contatosAtivos[cid].mensagens_recentes.length < 5) {
      contatosAtivos[cid].mensagens_recentes.push(msg);
    }
  });

  const idsAtivos = Object.keys(contatosAtivos);
  console.log(`Contatos ativos no período: ${idsAtivos.length}`);

  // 4. Buscar metadados completos de colunas do funil para resolver nomes
  const { data: colunasRaw } = await supabase.from('colunas_funil').select('id, nome');
  const mapaColunas = {};
  if (colunasRaw) {
    colunasRaw.forEach(col => {
      mapaColunas[col.id] = col.nome;
    });
  }

  // 5. Montar os dados de cada lead
  const leadsRelatorio = [];

  for (const cid of idsAtivos) {
    const stats = contatosAtivos[cid];

    // Buscar dados do contato
    const { data: contato } = await supabase
      .from('contatos')
      .select('*')
      .eq('id', cid)
      .single();

    if (!contato) continue;

    // Buscar telefone
    const { data: telefones } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', cid)
      .limit(1);
    const telefone = telefones && telefones[0]?.telefone || 'Sem telefone';

    // Buscar relação de funil e corretor responsável
    const { data: funil } = await supabase
      .from('contatos_no_funil')
      .select('id, coluna_id, corretor_id, created_at')
      .eq('contato_id', cid)
      .maybeSingle();

    let nomeCorretor = 'Não atribuído';
    if (funil && funil.corretor_id) {
      const { data: corretor } = await supabase
        .from('contatos')
        .select('nome')
        .eq('id', funil.corretor_id)
        .maybeSingle();
      if (corretor) nomeCorretor = corretor.nome;
    }

    // Buscar histórico de movimentação do funil
    let historicoTimeline = [];
    if (funil) {
      const { data: movs } = await supabase
        .from('historico_movimentacao_funil')
        .select('*')
        .eq('contato_no_funil_id', funil.id)
        .order('data_movimentacao', { ascending: true });

      if (movs && movs.length > 0) {
        movs.forEach(m => {
          const colAnt = mapaColunas[m.coluna_anterior_id] || 'Entrada / Sem Coluna';
          const colNova = mapaColunas[m.coluna_nova_id] || 'Desconhecida';
          historicoTimeline.push({
            data: new Date(m.data_movimentacao).toLocaleString('pt-BR'),
            origem: colAnt,
            destino: colNova
          });
        });
      }
    }

    leadsRelatorio.push({
      info: contato,
      telefone: telefone,
      coluna: funil ? (mapaColunas[funil.coluna_id] || 'Coluna Desconhecida') : 'Fora do Funil',
      corretor: nomeCorretor,
      cardCriadoEm: funil ? new Date(funil.created_at).toLocaleString('pt-BR') : null,
      stats: stats,
      timeline: historicoTimeline
    });
  }

  // 6. Construir o documento Markdown
  let md = `# Relatório Detalhado de Clientes e Andamento do Funil (WhatsApp)\n\n`;
  md += `> [!NOTE]\n`;
  md += `> Relatório gerado em tempo real com base nas mensagens recebidas e enviadas no período comercial.\n`;
  md += `> **Período analisado:** ${labelPeriodo}\n\n`;

  md += `## 📋 Visão Geral dos Leads Ativos (${leadsRelatorio.length})\n\n`;
  md += `| Lead | Telefone | Coluna Funil | Corretor Responsável | Stella IA | Msgs (Clie/Stella) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :---: |\n`;

  leadsRelatorio.forEach(l => {
    const stellaStatus = l.info.ia_atendimento_ativo ? '✅ Ativo' : '❌ Inativo';
    md += `| **${l.info.nome}** | \`${l.telefone}\` | ${l.coluna} | ${l.corretor} | ${stellaStatus} | ${l.stats.mensagens_inbound} / ${l.stats.mensagens_outbound} |\n`;
  });

  md += `\n---\n\n## 🔍 Fichas de Leads e Linhas do Tempo das Fases\n\n`;

  leadsRelatorio.forEach(l => {
    md += `### 👤 ${l.info.nome} (${l.info.tipo_contato || 'Lead'})\n\n`;
    md += `#### 📋 Informações Cadastrais\n`;
    md += `* **ID do Contato:** \`${l.info.id}\` | **Organização:** \`${l.info.organizacao_id === 2 ? 'Studio 57' : 'Org ' + l.info.organizacao_id}\` \n`;
    md += `* **Telefone:** \`${l.telefone}\`\n`;
    md += `* **Objetivo de Compra:** \`${l.info.objetivo || 'Não informado'}\` | **Cidade/UF:** \`${l.info.city || 'Não informada'}\`\n`;
    md += `* **Renda Familiar:** \`R$ ${l.info.renda_familiar !== null ? l.info.renda_familiar : 'Não declarada'}\`\n`;
    md += `* **FGTS:** \`${l.info.fgts ? 'SIM' : 'NÃO'}\` | **CLT (+3 anos):** \`${l.info.mais_de_3_anos_clt ? 'SIM' : 'NÃO'}\`\n`;
    md += `* **Piloto Automático Stella:** \`${l.info.ia_atendimento_ativo ? 'ATIVO' : 'DESATIVADO'}\`\n`;
    md += `* **Corretor Responsável:** \`${l.corretor}\`\n\n`;

    md += `#### ⏳ Histórico de Transição de Colunas (Fases do CRM)\n`;
    if (l.cardCriadoEm) {
      md += `* **Card Criado no Funil em:** \`${l.cardCriadoEm}\`\n`;
    }
    if (l.timeline.length > 0) {
      md += `| Data da Movimentação | Coluna Anterior | Coluna Nova |\n`;
      md += `| :--- | :--- | :--- |\n`;
      l.timeline.forEach(t => {
        md += `| ${t.data} | ${t.origem} | **${t.destino}** |\n`;
      });
    } else {
      md += `* *Nenhuma movimentação de coluna registrada no histórico para este card.* (Ele permanece na coluna inicial desde a criação)\n`;
    }
    md += `\n`;

    md += `#### 💬 Últimas Mensagens na Conversa (Ordem Inversa)\n`;
    l.stats.mensagens_recentes.forEach(msg => {
      const dataStr = new Date(msg.created_at).toLocaleString('pt-BR');
      const ator = msg.direction === 'inbound' ? '👤 Lead' : '🏢 Stella/Corretor';
      md += `* \`[${dataStr}] ${ator}\`: "${msg.content}"\n`;
    });
    md += `\n---\n\n`;
  });

  // 7. Escrever o arquivo
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const filePath = path.join(artifactsDir, 'relatorio_clientes_detalhado.md');
  fs.writeFileSync(filePath, md, 'utf8');
  console.log(`Relatório detalhado gerado com sucesso em: ${filePath}`);
}

main().catch(err => {
  console.error("Erro fatal na geração do relatório:", err);
  process.exit(1);
});
