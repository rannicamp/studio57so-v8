require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            titulo_guia: { type: SchemaType.STRING },
            secoes: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        titulo_secao: { type: SchemaType.STRING },
                        conteudo: { type: SchemaType.STRING, description: "Todo o texto e dicas desta seção detalhados" }
                    }
                }
            }
        },
        required: ["titulo_guia", "secoes"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function auditarPdf(caminhoArquivo) {
    try {
        console.log("Fazendo upload do arquivo para o Gemini...");
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Guia Corretores",
        });
        console.log("Upload concluído! Extraindo dados...");
        
        const prompt = "Leia esta análise de rentabilidade na íntegra. Extraia todas as seções, tópicos, argumentos de venda, regras e informações contidas nele. Preciso da estrutura completa e rica em detalhes para usá-la como modelo na criação de outro guia.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const jsonText = result.response.text();
        fs.writeFileSync('.agents/beta_suites/alfa_rentabilidade_extraida.json', jsonText);
        console.log("Extração salva com sucesso em .agents/beta_suites/alfa_rentabilidade_extraida.json");
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}

auditarPdf("I:\\2024_000_RESIDENCIAL ALFA\\DOCUMENTOS CORRETOR\\250304_Análise de rentabilidade_wa.pdf");
