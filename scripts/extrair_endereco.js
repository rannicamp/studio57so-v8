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
            endereco_completo: { type: SchemaType.STRING, description: "Endereço exato do empreendimento (Rua, Número, Bairro, Cidade)" },
            bairro: { type: SchemaType.STRING },
            cep: { type: SchemaType.STRING }
        },
        required: ["endereco_completo", "bairro"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function extrairEndereco(caminhoArquivo) {
    try {
        console.log(`Fazendo upload de ${caminhoArquivo}...`);
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Documento Beta Suites",
        });
        
        console.log(`Analisando com IA...`);
        const prompt = "Extraia o endereço completo do empreendimento/imóvel listado neste documento. Procure por Rua, Número, Lote, Quadra, Bairro, etc.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        console.log("Resultado: ", result.response.text());
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}

async function run() {
   await extrairEndereco("C:\\Users\\Ranniere\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2025_000_BETA SUÍTES\\2025_000_PROJETO LEGAL\\DOCUMENTOS\\BCI.pdf");
}

run();
