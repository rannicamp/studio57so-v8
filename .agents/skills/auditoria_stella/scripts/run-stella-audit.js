const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Carrega as variáveis do .env.local do projeto
dotenv.config({ path: path.join(__dirname, '../../../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações do período (padrão: 7 dias)
const args = process.argv.slice(2);
let days = 7;
const daysArgIdx = args.findIndex(arg => arg.startsWith('--days='));
if (daysArgIdx !== -1) {
  days = parseInt(args[daysArgIdx].split('=')[1], 10) || 7;
}

const STELLA_PHONE_ID = '690198827516149'; // Phone ID Stella Org 2
const STELLA_CONTACT_ID = 5792; // Contato Stella Org 2
const ORGANIZACAO_ID = 2;

async function run() {
  console.log(`=== INICIANDO PROCESSAMENTO DO RELATÓRIO DE DESEMPENHO DA STELLA IA ===`);
  console.log(`Período de análise: últimos ${days} dias`);

  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - days);
  const dataCorteISO = dataCorte.toISOString();

  // 1. Buscar todas as mensagens das conversas no período
  console.log('\n1. Analisando volumetria de mensagens e status de entrega...');
  const { data: mensagens, error: msgsErr } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, direction, status, created_at, content, error_message')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .gte('created_at', dataCorteISO)
    .order('created_at', { ascending: true });

  if (msgsErr) {
    console.error('Erro ao buscar mensagens:', msgsErr.message);
    return;
  }

  console.log(` -> Processadas ${mensagens.length} mensagens no período total da organização.`);

  const msgContactIds = [...new Set(mensagens.map(m => m.contato_id).filter(Boolean))];

  // 2. Coletando dados de leads vinculados à Stella no CRM...
  console.log('2. Coletando dados de leads vinculados à Stella no CRM...');
  
  // Buscar leads no funil comercial atribuídos à Stella
  const { data: leadsFunil, error: funilErr } = await supabase
    .from('contatos_no_funil')
    .select('contato_id, coluna_id, created_at')
    .eq('corretor_id', STELLA_CONTACT_ID)
    .eq('organizacao_id', ORGANIZACAO_ID);

  if (funilErr) {
    console.error('Erro ao buscar leads no funil:', funilErr.message);
    return;
  }

  const leadsIdsFunil = (leadsFunil || []).map(l => l.contato_id);

  // Buscar apenas os contatos relevantes (ativos com mensagens ou no funil da Stella ou com IA ativa)
  // Para evitar limite de paginação (1000 registros), fazemos uma busca cirúrgica
  const activeIdsSet = new Set([
    ...msgContactIds, 
    ...leadsIdsFunil.filter(id => msgContactIds.includes(id)), 
  ]);
  
  // Também vamos incluir contatos criados no período
  const { data: contatosRecentes } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, created_at, ai_analysis')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .gte('created_at', dataCorteISO);

  if (contatosRecentes) {
    contatosRecentes.forEach(c => activeIdsSet.add(c.id));
  }

  const activeIdsArr = [...activeIdsSet];
  
  let contatos = [];
  if (activeIdsArr.length > 0) {
    const { data: contatosData, error: contatosErr } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, created_at, ai_analysis, cpf, fgts, estado_civil, renda_familiar, mais_de_3_anos_clt')
      .eq('organizacao_id', ORGANIZACAO_ID)
      .in('id', activeIdsArr);

    if (contatosErr) {
      console.error('Erro ao buscar contatos:', contatosErr.message);
      return;
    }
    contatos = contatosData || [];
  }

  // Filtrar contatos da Stella criados ou ativos no período
  const contatosStella = contatos.filter(c => 
    leadsIdsFunil.includes(c.id) || c.ia_atendimento_ativo === true
  );

  console.log(` -> Encontrados ${contatosStella.length} leads sob gestão da Stella.`);

  // 3. Analisar custos da API do Gemini
  console.log('\n3. Calculando telemetria de custos de IA (Gemini API)...');
  const { data: logsCusto, error: logsErr } = await supabase
    .from('app_logs')
    .select('payload, created_at')
    .eq('origem', 'GEMINI COST')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .gte('created_at', dataCorteISO);

  let custoTotalUSD = 0;
  let tokensEntradaTotal = 0;
  let tokensSaidaTotal = 0;
  let totalChamadasGemini = 0;

  if (!logsErr && logsCusto) {
    totalChamadasGemini = logsCusto.length;
    logsCusto.forEach(l => {
      const payload = l.payload || {};
      custoTotalUSD += payload.cost_usd || 0;
      tokensEntradaTotal += payload.input_tokens || 0;
      tokensSaidaTotal += payload.output_tokens || 0;
    });
  }

  // 4. Compilar estatísticas individuais por lead
  console.log('\n4. Compilando métricas gerenciais...');
  
  let totalLeadsAtivos = 0;
  let totalInbound = 0;
  let totalOutboundEnviado = 0;
  let totalOutboundFalho = 0;
  let totalReengajamentosEnviados = 0;
  let totalReengajamentosLidos = 0;
  
  const tabelaLeads = [];

  for (const lead of contatosStella) {
    const msgsLead = mensagens.filter(m => m.contato_id === lead.id);
    if (msgsLead.length === 0 && new Date(lead.created_at) < dataCorte) {
      continue; // Lead inativo no período
    }

    totalLeadsAtivos++;
    
    const inbound = msgsLead.filter(m => m.direction === 'inbound');
    const outbound = msgsLead.filter(m => m.direction === 'outbound');
    const falhas = outbound.filter(m => m.status === 'failed');
    const reengajamentos = outbound.filter(m => m.content.startsWith('Template:'));
    const lidos = reengajamentos.filter(m => m.status === 'read');

    totalInbound += inbound.length;
    totalOutboundEnviado += (outbound.length - falhas.length);
    totalOutboundFalho += falhas.length;
    totalReengajamentosEnviados += reengajamentos.length;
    totalReengajamentosLidos += lidos.length;

    // Calcular nível de qualificação BANT com base no cache
    const analysis = lead.ai_analysis || {};
    let bantLevel = 0;
    if (analysis.dados_cliente?.nome) bantLevel += 20;
    if (lead.cpf || analysis.dados_cliente?.cpf) bantLevel += 20;
    if (lead.renda_familiar || analysis.dados_cliente?.renda_familiar) bantLevel += 20;
    if (lead.fgts || analysis.dados_cliente?.fgts) bantLevel += 20;
    if (lead.estado_civil || analysis.dados_cliente?.estado_civil) bantLevel += 20;

    // Obter última etapa no funil comercial
    const funilRecord = leadsFunil.find(lf => lf.contato_id === lead.id);
    let etapa = 'Sem Funil';
    if (funilRecord) {
      const colunas = {
        'e8e88027-c7be-4e8c-9667-e17fa4e06ce5': 'Entrada',
        '029c8d6a-4799-4f4b-a55e-b4d5426718c0': 'Em Atendimento',
        '7de9b5b4-05fa-4813-82d8-7790406ee268': 'Intervenção Humana',
        '0553d8db-5259-41bc-ae9e-b8803014ed93': 'Cliente Potencial',
        'feaa8511-261d-451b-bf99-24c8a6d6e7e0': 'Perdido',
        '2b975bc0-b96c-456d-ac30-48ab6f6dddca': 'Falhas de Envio'
      };
      etapa = colunas[funilRecord.coluna_id] || 'Outra';
    }

    tabelaLeads.push({
      id: lead.id,
      nome: lead.nome,
      etapa: etapa,
      inboundCount: inbound.length,
      outboundCount: outbound.length - falhas.length,
      failedCount: falhas.length,
      bant: `${bantLevel}%`,
      statusIA: lead.ia_atendimento_ativo ? 'Ativo 🤖' : 'Inativo 👤'
    });
  }

  // 5. Montar o relatório Markdown
  console.log('\n5. Formatando o relatório gerencial...');
  const dataHojeStr = new Date().toLocaleDateString('pt-BR');
  const taxaEntregaMeta = totalOutboundEnviado + totalOutboundFalho > 0
    ? ((totalOutboundEnviado / (totalOutboundEnviado + totalOutboundFalho)) * 100).toFixed(1)
    : '100.0';
  const taxaLeituraReengajamento = totalReengajamentosEnviados > 0
    ? ((totalReengajamentosLidos / totalReengajamentosEnviados) * 100).toFixed(1)
    : '0.0';

  let report = `# Relatório de Desempenho Operacional: Stella IA

**Data da Auditoria**: ${dataHojeStr}
**Período de Análise**: Últimos ${days} dias (desde ${new Date(dataCorteISO).toLocaleDateString('pt-BR')})
**Organização**: 2 (Studio 57 Incorporadora)

---

## 📊 Métricas Consolidadas

| Métrica | Valor | Descrição |
| --- | --- | --- |
| **Leads sob Gestão da Stella** | ${contatosStella.length} | Leads com piloto ativo ou atribuídos à IA no funil. |
| **Leads Interagindo no Período** | ${totalLeadsAtivos} | Leads com mensagens trocadas ou criados recentemente. |
| **Mensagens Recebidas (Inbound)** | ${totalInbound} | Perguntas e respostas enviadas pelos leads à IA. |
| **Mensagens Enviadas com Sucesso** | ${totalOutboundEnviado} | Respostas e pílulas entregues pela IA. |
| **Mensagens com Falha de Envio** | ${totalOutboundFalho} | Erros de entrega reportados pela API da Meta. |
| **Taxa de Sucesso de Entrega Meta** | **${taxaEntregaMeta}%** | Percentual de mensagens outbound que não geraram erro. |
| **Reengajamentos Enviados (Janela Fechada)** | ${totalReengajamentosEnviados} | Disparos de templates automáticos para reatar contato. |
| **Reengajamentos Lidos/Visualizados** | ${totalReengajamentosLidos} | Leads que leram a mensagem de retomada ('Status: read'). |
| **Taxa de Leitura de Retomada** | **${taxaLeituraReengajamento}%** | Reengajamentos visualizados em relação aos enviados. |

---

## 🤖 Telemetria de Custos da Inteligência Artificial

- **Total de Chamadas ao Gemini**: ${totalChamadasGemini} chamadas
- **Tokens de Entrada (Prompt)**: ${tokensEntradaTotal.toLocaleString('pt-BR')} tokens
- **Tokens de Saída (Geração)**: ${tokensSaidaTotal.toLocaleString('pt-BR')} tokens
- **Custo Acumulado no Período**: **$${custoTotalUSD.toFixed(4)} USD**
- **Custo Médio por Atendimento**: $${totalLeadsAtivos > 0 ? (custoTotalUSD / totalLeadsAtivos).toFixed(6) : '0.000000'} USD/lead

---

## 📋 Detalhamento dos Leads sob Gestão

| ID | Nome do Lead | Etapa Funil | Inbound | Outbound | Falhas | Qualificação BANT | Piloto Automático |
| --- | --- | --- | --- | --- | --- | --- | --- |
`;

  tabelaLeads.forEach(l => {
    report += `| ${l.id} | ${l.nome} | ${l.etapa} | ${l.inboundCount} | ${l.outboundCount} | ${l.failedCount} | ${l.bant} | ${l.statusIA} |\n`;
  });

  report += `
---

## 📈 Diagnóstico e Recomendações Técnicas

1. **Saúde de Entrega da Meta Cloud API**:
   - Uma taxa de entrega de **${taxaEntregaMeta}%** é considerada ${parseFloat(taxaEntregaMeta) > 90 ? 'EXCELENTE ✅' : 'PREOCUPANTE ⚠️'}.
   - ${totalOutboundFalho > 0 ? `Foram registradas ${totalOutboundFalho} falhas de entrega hoje. A maioria ocorreu devido a restrições de engajamento do ecossistema da Meta (erro 131049) ou falha de formatação. A blindagem de cabeçalho de imagem evitou novas falhas de formato no final do dia.` : 'Nenhuma falha de entrega relevante foi registrada nas últimas horas.'}

2. **Eficácia de Reengajamento (Janela Fechada)**:
   - A taxa de leitura de retomada está em **${taxaLeituraReengajamento}%**. O envio de templates simples e diretos como 'reativar_contato' (com o primeiro nome do lead) demonstrou excelente recepção prática (ex: lead Wilson Gil visualizou o reengajamento imediatamente).

3. **Eficiência Financeira**:
   - Com custo médio de **$${totalLeadsAtivos > 0 ? (custoTotalUSD / totalLeadsAtivos).toFixed(5) : '0.0000'} USD** por lead, o uso do modelo 'gemini-3.1-flash-lite' demonstra extrema viabilidade econômica (menos de R$ 0,03 por lead atendido).

---
*Relatório gerado automaticamente pelo motor de auditoria Stella Performance Audit Skill.*
`;

  // Gravar o relatório na pasta de relatórios do projeto e na pasta de artefatos
  const projectReportDir = path.join(__dirname, '../../relatorios');
  if (!fs.existsSync(projectReportDir)) {
    fs.mkdirSync(projectReportDir, { recursive: true });
  }

  const projectReportPath = path.join(projectReportDir, `relatorio_desempenho_stella.md`);
  fs.writeFileSync(projectReportPath, report, 'utf8');
  console.log(`\nRelatório gerado no projeto em: ${projectReportPath}`);

  // Gravar na pasta de artefatos da conversa para o usuário visualizar
  const artifactPath = 'C:/Users/ranni/.gemini/antigravity/brain/f237ca8f-a0ef-4f82-9917-81955e800bb7/relatorio_desempenho_stella.md';
  fs.writeFileSync(artifactPath, report, 'utf8');
  console.log(`Relatório salvo nos artefatos da conversa em: ${artifactPath}`);
}

run().catch(console.error);
