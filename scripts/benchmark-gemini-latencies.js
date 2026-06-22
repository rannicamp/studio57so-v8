// scripts/benchmark-gemini-latencies.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Chave GEMINI_API_KEY não configurada no .env.local');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Modelos a testar
const MODELS = [
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-1.5-pro',
  'gemini-3.1-pro-preview'
];

const TEST_PROMPT = 'Você é a assistente Stella. Responda apenas com a palavra "Olá" para testar conexão.';

async function testModel(modelName) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const start = Date.now();
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
      generationConfig: { maxOutputTokens: 10 }
    });
    const text = result.response.text().trim();
    const duration = Date.now() - start;
    return {
      modelName,
      success: true,
      durationMs: duration,
      response: text,
      error: null
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      modelName,
      success: false,
      durationMs: duration,
      response: null,
      error: err.message || err.toString()
    };
  }
}

async function run() {
  console.log('🏁 Iniciando Benchmark de Latência das APIs do Gemini...');
  console.log(`Prompt de teste: "${TEST_PROMPT}"\n`);

  const resultados = [];
  
  // Rodamos sequencialmente para não enviesar a medição de latência com concorrência local
  for (const modelName of MODELS) {
    console.log(`⏳ Testando modelo: ${modelName}...`);
    const res = await testModel(modelName);
    resultados.push(res);
    if (res.success) {
      console.log(`   ✅ SUCESSO | Tempo: ${res.durationMs}ms | Resposta: "${res.response}"`);
    } else {
      console.log(`   ❌ FALHA   | Tempo: ${res.durationMs}ms | Erro: "${res.error.substring(0, 100)}..."`);
    }
    // pequeno intervalo
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n======================================================');
  console.log('📊 RESULTADOS DO BENCHMARK DE LATÊNCIA:');
  console.log('======================================================');
  
  // Ordena por tempo de resposta (sucessos primeiro)
  resultados.sort((a, b) => {
    if (a.success && !b.success) return -1;
    if (!a.success && b.success) return 1;
    return a.durationMs - b.durationMs;
  });

  console.log('| Modelo | Status | Latência (ms) | Resposta/Erro |');
  console.log('| :--- | :---: | :---: | :--- |');
  resultados.forEach(r => {
    const status = r.success ? '✅ OK' : '❌ ERRO';
    const respOrErr = r.success ? `"${r.response}"` : `*${r.error.substring(0, 50)}...*`;
    console.log(`| \`${r.modelName}\` | ${status} | ${r.durationMs}ms | ${respOrErr} |`);
  });
  console.log('======================================================\n');
}

run().catch(console.error);
