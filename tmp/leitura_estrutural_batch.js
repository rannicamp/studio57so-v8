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
            concreto_m3: { type: SchemaType.NUMBER, description: "Soma total do Volume de concreto (em m3) listado em todos os resumos de materiais de todas as pranchas enviadas." },
            forma_m2: { type: SchemaType.NUMBER, description: "Soma total da Área de forma (em m2) listada nas tabelas de resumo das pranchas enviadas." },
            aco_kg: { type: SchemaType.NUMBER, description: "Total de aço em todos os resumos." },
            aco_detalhado: {
                type: SchemaType.ARRAY,
                description: "Soma total de aço por bitola, compilando o resumo de todas as folhas num array consolidado único.",
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        bitola: { type: SchemaType.STRING, description: "Ex: '5.0', '10.0', '12.5'" },
                        peso_kg: { type: SchemaType.NUMBER },
                        total_linear_m: { type: SchemaType.NUMBER }
                    },
                    required: ["bitola", "peso_kg", "total_linear_m"]
                }
            },
            paginas_com_resumo: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "Quais folhas possuíam as tabelas de resumo lidas para essa consolidação final."
            }
        },
        required: ["concreto_m3", "forma_m2", "aco_detalhado"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function processarBatch(pastaPath) {
    const arquivos = fs.readdirSync(pastaPath).filter(f => f.endsWith('.png')).sort();
    console.log(`\n🏗️ Subindo ${arquivos.length} imagens em Batch para a File API...`);
    
    let parts = [];
    
    for (let i = 0; i < arquivos.length; i++) {
        const arquivo = arquivos[i];
        const caminhoCompleto = path.join(pastaPath, arquivo);
        console.log(`Subindo ${arquivo}...`);
        
        try {
            const uploadResponse = await fileManager.uploadFile(caminhoCompleto, {
                mimeType: "image/png",
                displayName: arquivo,
            });
            parts.push({
                fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri }
            });
        } catch (e) {
            console.error(`Erro ao subir ${arquivo}: ${e.message}`);
        }
    }
    
    console.log(`\n🧠 Acionando Gemini 2.5 Flash com ${parts.length} imagens... Processando...`);
    
    const prompt = "Você está analisando diversas pranchas de um projeto estrutural (forma e armação). Sua tarefa é localizar os quadros de 'Resumo de Materiais' ou 'Relação de Aço' que geralmente ficam nas laterais ou cantos de algumas folhas. Localize as tabelas de resumo que aparecem nas folhas e extraia os GASTOS TOTAIS para estas pranchas somados (Volume de concreto, Formas e detalhamento dos tamanhos dos ferros e bitolas). Cuidado com duplicações se as páginas tiverem resumos acumulados, nesse caso use o Resumo Global. Me dê os dados consolidados.";

    parts.push({ text: prompt });

    try {
        const result = await model.generateContent(parts);
        console.log("\n========================================================");
        console.log("🏅 DADOS CONSOLIDADOS OBTIDOS");
        console.log("========================================================");
        console.log(result.response.text());
        fs.writeFileSync("resultado_quantitativos.json", result.response.text());
        console.log("\n-> Salvo em resultado_quantitativos.json");
    } catch (e) {
         console.error(`Erro no Gemini: ${e.message}`);
    }
}

const pastaImagens = path.join(__dirname, 'alfa_images');
processarBatch(pastaImagens);
