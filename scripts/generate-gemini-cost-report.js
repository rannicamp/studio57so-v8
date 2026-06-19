// scripts/generate-gemini-cost-report.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carrega chaves do .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function generateReport() {
  console.log('📊 Conectando ao Supabase para gerar o relatório de custos do Gemini...');
  
  const { data: logs, error } = await supabase
    .from('app_logs')
    .select('*')
    .eq('origem', 'GEMINI COST')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar logs:', error.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log('⚠️ Nenhum log de custo do Gemini encontrado na tabela app_logs.');
    return;
  }

  console.log(`✅ Sucesso! Encontrados ${logs.length} registros de telemetria de custo.`);

  // Consolidando métricas
  let custoTotalUSD = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let chamadasSucesso = 0;
  let chamadasFalha = 0;

  const porOrigem = {};
  const porModelo = {};
  const porDia = {};

  logs.forEach(log => {
    const payload = log.payload || {};
    const success = payload.success !== false;
    const cost = parseFloat(payload.cost_usd || 0);
    const input = parseInt(payload.input_tokens || 0, 10);
    const output = parseInt(payload.output_tokens || 0, 10);
    const model = payload.modelo || log.mensagem?.match(/stella \(([^)]+)\)/i)?.[1] || 'desconhecido';
    const rawOrigem = payload.origem_chamada || log.mensagem?.match(/custo\s+\w+\s+\([^)]+\)\s+-\s+([^-:\n]+)/i)?.[1]?.trim() || 'Desconhecido';
    const dataDia = new Date(log.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    custoTotalUSD += cost;
    totalTokensInput += input;
    totalTokensOutput += output;
    
    if (success) {
      chamadasSucesso++;
    } else {
      chamadasFalha++;
    }

    // Por Origem
    if (!porOrigem[rawOrigem]) {
      porOrigem[rawOrigem] = { custo: 0, chamadas: 0, input: 0, output: 0 };
    }
    porOrigem[rawOrigem].custo += cost;
    porOrigem[rawOrigem].chamadas++;
    porOrigem[rawOrigem].input += input;
    porOrigem[rawOrigem].output += output;

    // Por Modelo
    if (!porModelo[model]) {
      porModelo[model] = { custo: 0, chamadas: 0, input: 0, output: 0 };
    }
    porModelo[model].custo += cost;
    porModelo[model].chamadas++;
    porModelo[model].input += input;
    porModelo[model].output += output;

    // Por Dia
    if (!porDia[dataDia]) {
      porDia[dataDia] = { custo: 0, chamadas: 0 };
    }
    porDia[dataDia].custo += cost;
    porDia[dataDia].chamadas++;
  });

  const taxaCambio = 5.45; // USD para BRL aproximado
  const custoTotalBRL = custoTotalUSD * taxaCambio;

  // Gerando Relatório Markdown
  let mdContent = `# 📈 Relatório de Telemetria e Custos - Google Gemini API\n\n`;
  mdContent += `*Relatório gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Fuso de Brasília)*\n\n`;
  
  mdContent += `## 💰 Resumo Geral Consolidado\n`;
  mdContent += `| Métrica | Valor |\n`;
  mdContent += `| :--- | :--- |\n`;
  mdContent += `| **Custo Acumulado (USD)** | **$${custoTotalUSD.toFixed(6)} USD** |\n`;
  mdContent += `| **Custo Estimado (BRL)** | **R$ ${custoTotalBRL.toFixed(2)} BRL** (Câmbio ~R$ ${taxaCambio.toFixed(2)}) |\n`;
  mdContent += `| **Volume Total de Chamadas** | **${logs.length} chamadas** (✅ ${chamadasSucesso} sucesso / ❌ ${chamadasFalha} falha) |\n`;
  mdContent += `| **Total Tokens Consumidos** | **${(totalTokensInput + totalTokensOutput).toLocaleString()}** (${totalTokensInput.toLocaleString()} entrada / ${totalTokensOutput.toLocaleString()} saída) |\n\n`;

  mdContent += `## 📂 Consumo por Módulo/Origem do Sistema\n`;
  mdContent += `| Módulo / Rota | Chamadas | Custo (USD) | Custo Est. (BRL) | Tokens (In/Out) |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :---: |\n`;
  
  Object.entries(porOrigem)
    .sort((a, b) => b[1].custo - a[1].custo)
    .forEach(([origemName, data]) => {
      mdContent += `| \`${origemName}\` | ${data.chamadas} | $${data.custo.toFixed(4)} | R$ ${(data.custo * taxaCambio).toFixed(2)} | ${data.input.toLocaleString()} / ${data.output.toLocaleString()} |\n`;
    });
  
  mdContent += `\n`;

  mdContent += `## 🤖 Consumo por Modelo de Inteligência Artificial\n`;
  mdContent += `| Modelo Utilizado | Chamadas | Custo (USD) | Custo Est. (BRL) | Tokens (In/Out) |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :---: |\n`;
  
  Object.entries(porModelo)
    .sort((a, b) => b[1].custo - a[1].custo)
    .forEach(([modelName, data]) => {
      mdContent += `| \`${modelName}\` | ${data.chamadas} | $${data.custo.toFixed(4)} | R$ ${(data.custo * taxaCambio).toFixed(2)} | ${data.input.toLocaleString()} / ${data.output.toLocaleString()} |\n`;
    });

  mdContent += `\n`;

  mdContent += `## 📅 Histórico de Consumo Diário\n`;
  mdContent += `| Dia | Chamadas | Custo (USD) | Custo Est. (BRL) |\n`;
  mdContent += `| :--- | :---: | :---: | :---: |\n`;
  
  Object.entries(porDia)
    .sort((a, b) => {
      const [diaA, mesA, anoA] = a[0].split('/');
      const [diaB, mesB, anoB] = b[0].split('/');
      return new Date(anoB, mesB - 1, diaB) - new Date(anoA, mesA - 1, diaA);
    })
    .forEach(([diaStr, data]) => {
      mdContent += `| ${diaStr} | ${data.chamadas} | $${data.custo.toFixed(4)} | R$ ${(data.custo * taxaCambio).toFixed(2)} |\n`;
    });

  // Salvar relatório na pasta de artefatos
  const artifactDir = path.resolve(process.env.APP_DATA_DIR || path.join(process.env.USERPROFILE, '.gemini', 'antigravity', 'brain', 'f237ca8f-a0ef-4f82-9917-81955e800bb7'));
  const reportPath = path.join(artifactDir, 'relatorio_custos_gemini.md');
  
  try {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(reportPath, mdContent, 'utf8');
    console.log(`\n📄 Relatório Markdown salvo com sucesso em:\n   ${reportPath}\n`);
  } catch (err) {
    console.error('⚠️ Erro ao gravar arquivo do relatório nos artefatos:', err.message);
  }

  // Resumo no terminal
  console.log('\n--- RESUMO DE CONSUMO ---');
  console.log(`Total Gasto: $${custoTotalUSD.toFixed(4)} USD (~R$ ${custoTotalBRL.toFixed(2)} BRL)`);
  console.log(`Chamadas: ${logs.length} (${chamadasSucesso} OK, ${chamadasFalha} Erro)`);
  console.log('-------------------------\n');
}

generateReport().catch(err => {
  console.error('❌ Erro inesperado ao processar relatório:', err);
});
