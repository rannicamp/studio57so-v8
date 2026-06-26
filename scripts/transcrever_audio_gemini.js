const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Função para localizar o arquivo de áudio de forma robusta
function locateAudioFile() {
  const baseDir = "C:\\Users\\ranni\\OneDrive";
  const items = fs.readdirSync(baseDir);
  for (const item of items) {
    const fullPath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item.startsWith("S57 INCORPORA")) {
      const candidatePath = path.join(fullPath, "MARKETING", "VIDEOS RANNIERE", "S57 - 2506.mp3");
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }
  throw new Error("Arquivo de áudio S57 - 2506.mp3 não encontrado.");
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não encontrada no arquivo .env.local!");
    process.exit(1);
  }
  
  let audioFilePath;
  try {
    audioFilePath = locateAudioFile();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  
  console.log(`Carregando áudio do caminho: ${audioFilePath}`);
  
  const fileManager = new GoogleAIFileManager(apiKey);
  const genAI = new GoogleGenerativeAI(apiKey);
  
  console.log("Fazendo upload do áudio para a API do Gemini...");
  const uploadResult = await fileManager.uploadFile(audioFilePath, {
    mimeType: "audio/mp3",
    displayName: "S57 - 2506 Audio"
  });
  
  console.log(`Upload concluído! Nome na API: ${uploadResult.file.name} | URI: ${uploadResult.file.uri}`);
  
  console.log("Iniciando transcrição e geração de legenda com o modelo Gemini...");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  try {
    const response = await model.generateContent([
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType
        }
      },
      {
        text: `Você é um redator de publicidade de alto nível focado no mercado imobiliário e design de luxo para o Instagram da incorporadora "Studio 57" (a construtora e incorporadora física) e seu software de gestão "Elo 57".
        
        Por favor, siga estas etapas:
        1. Escute o áudio em anexo e faça a TRANSCRIÇÃO completa e literal dele em português (Brasil).
        2. Entenda o conteúdo e crie uma LEGENDA INCRÍVEL para o Instagram.
        
        Diretrizes para a legenda:
        - O tom deve ser moderno, sofisticado, engajador e inspirador (refletindo design de alto padrão, arquitetura e luxo inteligente da Studio 57).
        - Divida o texto em parágrafos curtos e use emojis elegantes estrategicamente para dar ritmo à leitura.
        - Termine a legenda com uma "CTA" (Call to Action / Chamada para Ação) forte incentivando as pessoas a curtirem, salvarem o post ou mandarem um Direct para saber mais.
        - Adicione hashtags inteligentes e estratégicas relacionadas ao mercado imobiliário, incorporações de luxo, arquitetura e à Studio 57 (ex: #Studio57, #ArquiteturaDeLuxo, #DesignExclusivo, #MercadoImobiliario, etc.).
        
        Estruture a sua resposta exatamente da seguinte forma:
        === TRANSCRIÇÃO DO ÁUDIO ===
        [Texto transcrito aqui]
        
        === LEGENDA PROPOSTA PARA O INSTAGRAM ===
        [Legenda aqui]
        `
      }
    ]);
    
    const outputText = response.response.text();
    console.log("\n================ RESULTADO ================\n");
    console.log(outputText);
    console.log("\n===========================================\n");
    
    // Salvar a saída em um arquivo txt no mesmo diretório de vídeos
    const videoDir = path.dirname(audioFilePath);
    const textOutputPath = path.join(videoDir, "legenda_instagram_2506.txt");
    fs.writeFileSync(textOutputPath, outputText);
    console.log(`Legenda e transcrição salvas em: ${textOutputPath}`);
    
  } catch (err) {
    console.error("Erro na geração de conteúdo:", err);
  } finally {
    // Limpar arquivo na API do Gemini
    console.log("Limpando arquivo da API do Gemini...");
    try {
      await fileManager.deleteFile(uploadResult.file.name);
      console.log("Limpeza concluída com sucesso!");
    } catch (cleanupErr) {
      console.error("Erro ao limpar arquivo na API do Gemini:", cleanupErr.message);
    }
  }
}

run().catch(console.error);
