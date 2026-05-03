require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); // Using pro for better text extraction

async function lerPdf() {
    try {
        const caminhoArquivo = "C:\\Users\\Ranniere\\Desktop\\guia corretores alfa.pdf";
        if (!fs.existsSync(caminhoArquivo)) {
            console.error("ERRO: Arquivo não encontrado!");
            return;
        }

        console.log("Fazendo upload do arquivo...");
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Guia Alfa PDF",
        });
        
        console.log("Arquivo processado pela IA. Extraindo texto...");
        const prompt = "Transcreva na íntegra todo o conteúdo textual deste manual, página por página. Preserve a formatação de tópicos, títulos e argumentos de vendas.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const text = result.response.text();
        fs.writeFileSync("texto_alfa_extraido.md", text, "utf-8");
        console.log("SUCESSO");
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}

lerPdf();
