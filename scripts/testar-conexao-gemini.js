// scripts/testar-conexao-gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  console.log('=== TESTANDO CONEXÃO COM OS SERVIDORES DO GOOGLE GEMINI ===');
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ ERRO: GEMINI_API_KEY não configurada no .env.local');
    process.exit(1);
  }

  console.log(`Chave detectada: ${apiKey.substring(0, 8)}...`);
  console.log('Enviando sinal (ping) para o Gemini 2.5 Flash usando @google/generative-ai...');

  const startTime = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const response = await model.generateContent('Ping. Responda apenas com a palavra PONG.');
    const endTime = Date.now();
    const duration = endTime - startTime;
    const textResult = response.response.text().trim();

    console.log(`\n🎉 Conexão estabelecida com sucesso!`);
    console.log(`⏱️ Tempo de resposta: ${duration}ms`);
    console.log(`🤖 Resposta do modelo: "${textResult}"`);

    if (textResult.toUpperCase().includes('PONG')) {
      console.log('✅ O teste respondeu exatamente como o esperado.');
    } else {
      console.log('⚠️ O teste respondeu, mas com um formato diferente de PONG.');
    }
  } catch (err) {
    console.error('\n❌ FALHA na conexão com o Gemini:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

run();
