require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// Instanciação Padrão
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Blindagem JSON
const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            possui_lavanderia: { type: SchemaType.BOOLEAN },
            area_gourmet_detalhes: { type: SchemaType.STRING },
            capacidade_pessoas_lazer: { type: SchemaType.STRING },
            outros_itens_lazer: { 
                type: SchemaType.ARRAY, 
                items: { type: SchemaType.STRING } 
            }
        },
        required: ["possui_lavanderia", "area_gourmet_detalhes", "capacidade_pessoas_lazer", "outros_itens_lazer"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-3.1", generationConfig });

async function auditarPdf() {
    const caminhoArquivo = "I:\\2024_000_RESIDENCIAL ALFA\\DOCUMENTOS CORRETOR\\BOOK ALFA - 2025_COMP..pdf";
    
    if (!fs.existsSync(caminhoArquivo)) {
        console.log("ERRO: O arquivo não existe no caminho: " + caminhoArquivo);
        return;
    }

    try {
        console.log("Iniciando upload do PDF para o Gemini...");
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Book Alfa PDF",
        });
        
        console.log("Upload concluído. Iniciando extração...");
        const prompt = "Analise este Book de vendas do Residencial Alfa e extraia as informações precisas sobre a área de lazer, incluindo se possui lavanderia, detalhes e nome da área gourmet, a capacidade de pessoas para eventos (ex: 88 pessoas) e quais são os outros itens de lazer e conveniência do prédio.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        console.log("RESULTADO JSON:", result.response.text());
    } catch (e) {
        console.error("Erro na leitura IA: ", e);
    }
}

auditarPdf();
