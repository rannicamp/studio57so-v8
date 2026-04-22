require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Usando o modelo gemini-2.5-flash (já que 3.1 não é um modelo válido na API da Google)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function downloadToTemp(bucket, filePath) {
  console.log(`Baixando: ${filePath}`);
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error) throw error;
  
  const buffer = Buffer.from(await data.arrayBuffer());
  const tempPath = path.join(os.tmpdir(), path.basename(filePath));
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

async function analyzeWithGemini(tempPath, prompt, mimeType) {
  console.log(`Enviando para Gemini: ${tempPath}`);
  let uploadResponse;
  try {
    uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType: mimeType,
      displayName: "Beta Suites Document",
    });

    const result = await model.generateContent([
      { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
      { text: prompt }
    ]);
    
    return result.response.text();
  } catch (e) {
    console.error("Erro na leitura IA: ", e.message);
    return null;
  } finally {
    // Clean up from Google AI Manager and Local File
    if (uploadResponse?.file?.name) {
      try { await fileManager.deleteFile(uploadResponse.file.name); } catch(err){}
    }
    fs.unlinkSync(tempPath);
  }
}

async function run() {
  let marketingData = {};

  try {
    // 1. LER BOOK DE VENDAS
    const bookPath = await downloadToTemp('empreendimento-anexos', '5/BOK_1764792832554.pdf');
    const bookPrompt = "Extraia um resumo completo do Book de Vendas: Identidade visual do projeto, Público-alvo, Tipologia das unidades, Diferenciais do condomínio, Conceito arquitetônico. Formate em texto rico detalhado para incluir no plano de marketing.";
    marketingData.bookResumo = await analyzeWithGemini(bookPath, bookPrompt, "application/pdf");

    // 2. LER TABELA DE VENDAS
    const tabPath = await downloadToTemp('empreendimento-anexos', '5/TAB_1772718402645.pdf');
    const tabPrompt = "Extraia as principais métricas de vendas: VGV total (se houver), ticket médio das unidades, m² privativo e total, regras de financiamento ou fluxo de pagamento. Seja muito detalhista nos valores financeiros para investidores.";
    marketingData.tabelaVendas = await analyzeWithGemini(tabPath, tabPrompt, "application/pdf");

    // 3. LER IDENTIDADE VISUAL
    const idPath = await downloadToTemp('empreendimento-anexos', '5/RLT_1759150758854.pdf');
    const idPrompt = "Resuma o Manual de Identidade Visual. Quais são as cores predominantes, conceitos das fontes, paleta principal, elementos gráficos e como eles devem ser usados na comunicação do empreendimento?";
    marketingData.identidadeVisual = await analyzeWithGemini(idPath, idPrompt, "application/pdf");

    fs.writeFileSync('c:\\Projetos\\studio57so-v8\\tmp\\beta_suites_ai_analysis.json', JSON.stringify(marketingData, null, 2));
    console.log("Análise de IA concluída e salva na memória/arquivo temporário.");
  } catch (error) {
    console.error("Erro fatal:", error);
  }
}

run();
