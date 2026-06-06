const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let apiKey = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('GEMINI_API_KEY=')) {
        apiKey = line.split('=')[1].trim();
    }
});

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            missao: { type: SchemaType.STRING, description: "A Missão exata do Studio 57 (se existir no texto)." },
            visao: { type: SchemaType.STRING, description: "A Visão exata do Studio 57 (se existir no texto)." },
            valores: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Os Valores do Studio 57 (se existir no texto)." },
            outros_fragmentos: { type: SchemaType.STRING, description: "Outros trechos institucionais ou conceituais importantes." }
        },
        required: ["missao", "visao", "valores", "outros_fragmentos"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function extrairDados(caminhoArquivo, nome) {
    try {
        console.log(`Fazendo upload do arquivo: ${nome}...`);
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: nome,
        });
        
        console.log(`Upload concluído. Iniciando extração com IA...`);
        const prompt = "Analise este documento e extraia rigorosamente as informações institucionais do Studio 57, focando principalmente em Missão, Visão e Valores institucionais. Se não houver, deixe em branco ou informe 'Não encontrado'.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        console.log(`Dados extraídos com sucesso para: ${nome}`);
        return JSON.parse(result.response.text());
    } catch (e) {
        console.error(`Erro na leitura IA de ${nome}: `, e.message);
        return null;
    }
}

async function main() {
    const arquivos = [
        {
            path: 'C:\\Users\\Ranniere\\OneDrive\\Área de Trabalho\\IA\\STUDIELLY - A CORRETORA\\Sobre nós - Studio 57 Arquitetura Integrada.pdf',
            nome: 'Sobre Nós PDF'
        },
        {
            path: 'C:\\Users\\Ranniere\\OneDrive\\Área de Trabalho\\IA\\STUDIELLY - A CORRETORA\\000_DOCS UNIFICADOS_V3.pdf',
            nome: 'Docs Unificados V3'
        }
    ];

    let consolidado = [];

    for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo.path)) {
            const dados = await extrairDados(arquivo.path, arquivo.nome);
            if (dados) {
                consolidado.push({ fonte: arquivo.nome, dados });
            }
            // Delay de 5s para rate limit
            await new Promise(r => setTimeout(r, 5000));
        } else {
            console.log(`Arquivo não encontrado: ${arquivo.path}`);
        }
    }

    fs.writeFileSync('C:\\Users\\Ranniere\\.gemini\\antigravity\\brain\\4e8a9b5c-cd8e-46a6-918f-44da39f27a1a\\scratch\\studio57_missao_visao_raw.json', JSON.stringify(consolidado, null, 2), 'utf-8');
    console.log("Extração finalizada e salva no arquivo raw!");
}

main();
