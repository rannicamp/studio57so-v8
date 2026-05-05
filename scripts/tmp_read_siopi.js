require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Helper to find file by partial name to avoid encoding/accent issues
function findFile(dir, partialName) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file.toLowerCase().includes(partialName.toLowerCase())) {
            return path.join(dir, file);
        }
    }
    return null;
}

const dir = "C:\\Users\\ranni\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2024_000_RESIDENCIAL ALFA\\SIOPI";

const arquivos = [
    {
        caminho: findFile(dir, "ALVARA"),
        nome: "Alvará de Construção",
        prompt: "Leia este Alvará de Construção. Extraia o número do Alvará, o órgão emissor (ex: Prefeitura de Governador Valadares), e a data de emissão/validade.",
        schema: {
            numero_alvara: { type: SchemaType.STRING },
            orgao_emissor: { type: SchemaType.STRING },
            data_emissao: { type: SchemaType.STRING }
        }
    },
    {
        caminho: findFile(dir, "Orçamento Sintético"),
        nome: "Orçamento Sintético",
        prompt: "Leia este orçamento sintético da obra. Extraia o custo total (Custo Global / Valor Total Orçado) da construção.",
        schema: {
            custo_total_obra: { type: SchemaType.STRING }
        }
    },
    {
        caminho: findFile(dir, "Cronograma"),
        nome: "Cronograma Físico-Financeiro",
        prompt: "Leia este cronograma. Extraia o prazo total da obra em meses e a data ou mês/ano previsto para o término/entrega.",
        schema: {
            prazo_obra_meses: { type: SchemaType.STRING },
            previsao_entrega: { type: SchemaType.STRING }
        }
    }
];

async function executar() {
    const resultados = {};
    
    for (const doc of arquivos) {
        console.log(`\nProcessando: ${doc.nome}...`);
        if (!doc.caminho || !fs.existsSync(doc.caminho)) {
            console.log(`ERRO: Arquivo não encontrado para ${doc.nome} -> ${doc.caminho}`);
            continue;
        }

        try {
            console.log(`Fazendo upload: ${doc.caminho}`);
            const uploadResponse = await fileManager.uploadFile(doc.caminho, {
                mimeType: "application/pdf",
                displayName: doc.nome,
            });
            
            const generationConfig = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: doc.schema,
                    required: Object.keys(doc.schema)
                }
            };
            
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });
            
            console.log(`Analisando...`);
            const result = await model.generateContent([
                { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
                { text: doc.prompt }
            ]);
            
            resultados[doc.nome] = JSON.parse(result.response.text());
            console.log(`Sucesso!`);
            
            // Delay para evitar Rate Limit
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.error(`Falha em ${doc.nome}: `, e.message);
        }
    }
    
    console.log("\n--- RESULTADOS SIOPI ---");
    console.log(JSON.stringify(resultados, null, 2));
}

executar();
