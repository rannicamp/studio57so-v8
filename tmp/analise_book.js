require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY não encontrada no .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            resumo_book: { type: SchemaType.STRING, description: "Resumo das principais informações do Empreendimento encontradas no Book." },
            inconsistencias_encontradas: { 
                type: SchemaType.ARRAY, 
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        topico: { type: SchemaType.STRING },
                        valor_no_book: { type: SchemaType.STRING },
                        valor_correto_esperado: { type: SchemaType.STRING },
                        descricao_do_erro: { type: SchemaType.STRING }
                    }
                }
            },
            pontos_atencao: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "Outros erros de português, concordância ou informações estranhas no texto."
            }
        },
        required: ["resumo_book", "inconsistencias_encontradas", "pontos_atencao"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function auditarBook() {
    const caminhoArquivo = "C:\\Users\\ranni\\OneDrive\\S57 INCORPORAÇÕES\\EMPREENDIMENTOS\\BETA SUÍTES\\MARKETING\\CONTEUDO BASE\\BOK_1764792832554.pdf";
    
    if (!fs.existsSync(caminhoArquivo)) {
        console.error("Arquivo PDF não encontrado:", caminhoArquivo);
        return;
    }

    try {
        console.log("Fazendo upload do PDF para a API do Gemini...");
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Auditoria Book Beta Suites",
        });
        
        console.log("Upload concluído. Iniciando análise...");

        const prompt = `
        Você é o Devonildo, auditor de qualidade da Studio 57.
        Analise o Book de Vendas do empreendimento "Beta Suítes" anexo a esta mensagem.
        
        O que nós já sabemos como VERDADE ABSOLUTA sobre o Beta Suítes (baseado nos anúncios de marketing recém-criados):
        - Nome do Empreendimento: Beta Suítes
        - Preço Inicial das Suítes: a partir de R$ 189.979
        - Condição de Entrada: Apenas 20% de Entrada
        - Parcelamento: Parcelas a partir de R$ 1.800/mês
        - Localização: Alto Esplanada, Governador Valadares
        
        Sua tarefa:
        1. Ler cuidadosamente todo o texto do Book.
        2. Fazer um resumo das principais características do prédio e das unidades descritas no PDF.
        3. Procurar ativamente por QUALQUER inconsistência entre o que está escrito no Book e a VERDADE ABSOLUTA listada acima (Ex: preços diferentes, localização escrita errada, condições de pagamento divergentes).
        4. Procurar por erros de digitação, erros de português ou frases que não fazem sentido no marketing.
        
        Retorne estritamente o JSON no formato definido.
        `;

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const output = result.response.text();
        fs.writeFileSync("tmp/resultado_auditoria_book.json", output);
        console.log("Análise concluída. Resultado salvo em tmp/resultado_auditoria_book.json");
        
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}

auditarBook();
