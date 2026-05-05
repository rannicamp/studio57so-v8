require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Helper to find file
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

const dirSiopi = "C:\\Users\\ranni\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2024_000_RESIDENCIAL ALFA\\SIOPI";

const arquivos = [
    {
        caminho: findFile(dirSiopi, "Alvar"),
        nome: "Alvará de Construção",
        prompt: "Leia este Alvará de Construção. Extraia o número do Alvará, o órgão emissor, a data de emissão e se há alguma menção à aprovação prévia em outros órgãos como o Corpo de Bombeiros (AVCB/Projeto de Incêndio).",
        schema: {
            numero_alvara: { type: SchemaType.STRING },
            orgao_emissor: { type: SchemaType.STRING },
            data_emissao: { type: SchemaType.STRING },
            aprovacao_bombeiros: { type: SchemaType.STRING }
        }
    },
    {
        caminho: findFile(dirSiopi, "MEMORIAL DESCRITIVO_ALFA"),
        nome: "Memorial Descritivo",
        prompt: "Leia este memorial descritivo. Extraia um resumo sobre os materiais de acabamento utilizados nos apartamentos e áreas comuns, focando nos tipos de piso (ex: porcelanato), revestimentos de paredes molhadas, tipo de bancada (granito, mármore) e forro.",
        schema: {
            pisos: { type: SchemaType.STRING },
            revestimentos_parede: { type: SchemaType.STRING },
            bancadas: { type: SchemaType.STRING },
            forro: { type: SchemaType.STRING },
            resumo_padrao_acabamento: { type: SchemaType.STRING }
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
            const result = await model.generateContent([
                { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
                { text: doc.prompt }
            ]);
            resultados[doc.nome] = JSON.parse(result.response.text());
            console.log(`Sucesso!`);
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.error(`Falha em ${doc.nome}: `, e.message);
        }
    }
    console.log("\n--- RESULTADOS ADICIONAIS ---");
    console.log(JSON.stringify(resultados, null, 2));
}
executar();
