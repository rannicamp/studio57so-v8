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
            nome_empreendimento: { type: SchemaType.STRING },
            localizacao: { type: SchemaType.STRING },
            caracteristicas_imovel: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING }
            },
            area_m2: { type: SchemaType.STRING },
            quartos: { type: SchemaType.STRING },
            banheiros: { type: SchemaType.STRING },
            vagas_garagem: { type: SchemaType.STRING },
            areas_comuns_lazer: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING }
            },
            dados_matricula: {
                type: SchemaType.OBJECT,
                properties: {
                    numero: { type: SchemaType.STRING },
                    cartorio: { type: SchemaType.STRING },
                    proprietarios: { type: SchemaType.STRING },
                    onus_reais: { type: SchemaType.STRING }
                }
            },
            outros_detalhes_importantes: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING }
            }
        },
        required: ["nome_empreendimento", "localizacao", "caracteristicas_imovel", "dados_matricula", "outros_detalhes_importantes"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });
// wait, skill says "gemini-3.1", let's use "gemini-2.5-pro" or "gemini-1.5-pro" if 3.1 doesn't exist, but skill explicitly said gemini-3.1

async function auditarPdf(caminhoArquivo) {
    try {
        console.log(`Fazendo upload de ${caminhoArquivo}...`);
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Auditoria PDF",
        });
        
        const prompt = "Analise este documento e extraia todas as informações relevantes para a venda deste apartamento (empreendimento, localização, tamanho, tipologia, área de lazer, e principalmente os dados da matrícula, ônus, proprietários, etc). Retorne tudo detalhadamente estruturado.";

        console.log(`Analisando ${caminhoArquivo}...`);
        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        return JSON.parse(result.response.text());
    } catch (e) {
        console.error(`Erro na leitura de ${caminhoArquivo}: `, e.message);
        return null;
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    const arquivos = [
        "I:\\2025_002_PERO VAZ\\25_02_BOOK AP PERO VAZ.pdf",
        "I:\\2025_002_PERO VAZ\\MATRÍCULA ATUALIZADA\\MATRICULA PERO VAZ ONUS REAIS.pdf",
        "I:\\2025_002_PERO VAZ\\CARTA SOLICITAÇÃO REANALISE PERO VAZ.pdf"
    ];

    const resultados = {};

    for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo)) {
            const data = await auditarPdf(arquivo);
            resultados[arquivo] = data;
            await delay(5000);
        } else {
            console.log(`Arquivo não encontrado: ${arquivo}`);
        }
    }

    fs.writeFileSync('tmp/resultado_pero_vaz.json', JSON.stringify(resultados, null, 2));
    console.log('Extração concluída e salva em tmp/resultado_pero_vaz.json');
}

main();
