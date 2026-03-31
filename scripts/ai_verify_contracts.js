require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
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
            pertence_incorporacao: { type: SchemaType.BOOLEAN },
            cnpj_encontrado: { type: SchemaType.STRING },
            categoria_sigla: { type: SchemaType.STRING },
            data_documento: { type: SchemaType.STRING },
            justificativa: { type: SchemaType.STRING },
        },
        required: ["pertence_incorporacao", "cnpj_encontrado", "categoria_sigla", "data_documento", "justificativa"]
    }
};

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig
});

// A lista "premium"
const arquivosPremium = [
    "PRIMEIRA INCORPORAÇÃO LTDA - 1a. Alteração Contratual Consolidada.pdf",
    "Studio 57 Incorporações - 2a Alteracao Contratual.pdf",
    "S57 INCORPORAÇÕES - BALANÇO E DRE 2024_ASSINADO.pdf",
    "Balanço e DRE 2023 Studio 57.pdf",
    "Balanço e DRE 2022 Studio 57.pdf",
    "Balancete e DRE 2025 Studio 57.pdf",
    "Studio 57 Incorporações - Cartão CNPJ Novo.pdf",
    "CAU MG - CERTIDÃO REGISTRO E QUITAÇÃO - STUDIO 57 INCORPORAÇÕES.pdf",
    "Certidão de Inscrição Econômica - ATUALIZADA.pdf",
    "25_03_CND_RECEITA FEDERALCertidao-41464589000166-20250320_VALIDADE 16-09-25.pdf",
    "CND JUDICIAL CIVEL FEDERAL_b8a7c4a9-3d3b-40d1-98bb-90bd2d2a0d86.pdf",
    "CND TRABALHISTA_certidao_41464589000166.pdf",
    "RANNIERE - CERTIDÃO DE NASCIMENTO - VALIDAÇÃO_Certidão Eletrônica.pdf",
    "STUDIO 57 INCORPORAÇÕES - ATESTADO ALVARÁ.pdf"
];

function findFilePath(filename) {
    const ls = fs.readFileSync('C:\\temp_triagem_s57\\lista_arquivos_admin.txt', 'utf16le').split('\r\n');
    return ls.map(l => l.trim()).find(l => l.endsWith(filename));
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeFile(fullPath, filename) {
    try {
        console.log(`\nUpload: ${filename}`);
        let mime = "application/pdf";
        if(filename.toLowerCase().endsWith('.png')) mime = "image/png";
        if(filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) mime = "image/jpeg";

        const uploadResponse = await fileManager.uploadFile(fullPath, {
            mimeType: mime,
            displayName: filename,
        });
        
        const prompt = `Analise este documento meticulosamente.
1. O documento pertence à "STUDIO 57 INCORPORACOES LTDA" (CNPJ: 41.464.589/0001-66) ou pessoas físicas ligadas (sócios)? Responda pertence_incorporacao = true.
2. Se o documento for da empresa de arquitetura (CNPJ 04.419.458/0001-30), responda pertence_incorporacao = false.
3. Extraia o CNPJ exato, se visível.
4. Identifique a sigla da Categoria Oficial que ele pertence: CT (Certidões/CNPJ), BP (Balanços Patrimoniais/DRE), CS (Contrato Social/Alteração), REQ (Alvarás/Requerimentos) ou OUTROS.`;

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const responseJson = JSON.parse(result.response.text());
        return responseJson;

    } catch (e) {
        console.error("Erro no Gemini para " + filename + ": ", e.message);
        return { erro: e.message };
    }
}

async function main() {
    const results = [];
    
    for (const file of arquivosPremium) {
        const fullPath = findFilePath(file);
        if(!fullPath) continue;

        const stats = fs.statSync(fullPath);
        if(stats.size > 15 * 1024 * 1024) continue;
        
        let analysis = await analyzeFile(fullPath, file);
        analysis.arquivo = file;
        analysis.caminho_original = fullPath;
        results.push(analysis);
        
        console.log(`-> É INCORPORAÇÕES? ${analysis.pertence_incorporacao} | Categoria: ${analysis.categoria_sigla} | CNPJ: ${analysis.cnpj_encontrado}`);
        
        await delay(5000); 
    }
    
    fs.writeFileSync('C:\\temp_triagem_s57\\resultados_analise_ia.json', JSON.stringify(results, null, 2));
    console.log("Análise finalizada e salva.");
}

main();
