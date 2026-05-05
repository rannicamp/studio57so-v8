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
        if (file.includes(partialName)) {
            return path.join(dir, file);
        }
    }
    return null;
}

const arquivos = [
    {
        caminho: "I:\\2024_000_RESIDENCIAL ALFA\\DOCUMENTOS CORRETOR\\BOOK ALFA - 2025_COMP..pdf",
        nome: "Book Alfa",
        prompt: "Extraia todos os detalhes sobre a Ficha Técnica, produto, tipologia, área de lazer, características técnicas do prédio, andares e tudo que for relevante comercialmente.",
        schema: {
            tipo_apartamentos: { type: SchemaType.STRING },
            metragem_apartamentos: { type: SchemaType.STRING },
            quantidade_total_unidades: { type: SchemaType.STRING },
            andares_ou_pavimentos: { type: SchemaType.STRING },
            area_de_lazer_detalhes: { type: SchemaType.STRING },
            diferenciais_arquitetonicos: { type: SchemaType.STRING },
            outros_dados_relevantes: { type: SchemaType.STRING }
        }
    },
    {
        caminho: "I:\\2024_000_RESIDENCIAL ALFA\\DOCUMENTOS CORRETOR\\251013_ALFA - TABELA DE VENDAS.pdf",
        nome: "Tabela de Vendas",
        prompt: "Extraia o valor do m2 médio, o preço base de uma unidade, as condições de pagamento (ato, obra, financiamento) e o reajuste aplicado (INCC, IGPM).",
        schema: {
            preco_m2_medio: { type: SchemaType.STRING },
            ticket_medio_unidade: { type: SchemaType.STRING },
            condicoes_pagamento_resumo: { type: SchemaType.STRING },
            indice_reajuste_obra: { type: SchemaType.STRING },
            indice_reajuste_pos_obra: { type: SchemaType.STRING }
        }
    },
    {
        caminho: findFile("Y:\\EMPREENDIMENTOS\\RESIDENCIAL ALFA\\ALFA - JURÍDICO\\REGISTRO INCORPORAÇÃO DOCS FINAIS", "CERTIDAO DE INTEIRO TEOR - MATRICULA"),
        nome: "Matrícula e RI",
        prompt: "Leia esta certidão de inteiro teor. Extraia o número da Matrícula do terreno, o Cartório, o tamanho do terreno (área em m2), as confrontações e, PRINCIPALMENTE, localize a averbação do Registro de Incorporação (RI) e extraia o número do RI / R. da Incorporação.",
        schema: {
            numero_matricula: { type: SchemaType.STRING },
            cartorio: { type: SchemaType.STRING },
            area_terreno_m2: { type: SchemaType.STRING },
            numero_registro_incorporacao: { type: SchemaType.STRING },
            dados_proprietario_incorporadora: { type: SchemaType.STRING }
        }
    },
    {
        caminho: findFile("Y:\\EMPREENDIMENTOS\\RESIDENCIAL ALFA\\ALFA - JURÍDICO\\REGISTRO INCORP CARTÓRIO", "REQUERIMENTO_AVERBA"),
        nome: "Patrimônio de Afetação",
        prompt: "Leia este requerimento. Identifique se trata-se de solicitação de Patrimônio de Afetação para o Residencial Alfa, qual o CNPJ da SPE (Sociedade de Propósito Específico) e a finalidade.",
        schema: {
            solicitacao_patrimonio_afetacao: { type: SchemaType.BOOLEAN },
            cnpj_spe: { type: SchemaType.STRING },
            nome_spe: { type: SchemaType.STRING },
            resumo_requerimento: { type: SchemaType.STRING }
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
    
    fs.writeFileSync('C:\\Projetos\\studio57so-v8\\.agents\\residencial_alfa\\extracao_alfa_raw.json', JSON.stringify(resultados, null, 2));
    console.log("\nEXTRAÇÃO CONCLUÍDA! Salvo em .agents\\residencial_alfa\\extracao_alfa_raw.json");
}

executar();
