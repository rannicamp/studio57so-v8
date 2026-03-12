Manual de Instruções: Leitor de PDF com Gemini 2.5 Flash (Node.js)Este manual vai te ensinar a abandonar o problemático "Base64" e enviar PDFs diretamente para a IA do Google ler de forma nativa. O segredo é fazer o upload do arquivo para os servidores do Google primeiro, e depois pedir para a IA olhar para ele.1. O Grande Mito: "Preciso de outra API?"Não! Você vai usar a exata mesma chave (API_KEY) que você já tem hoje. A diferença é que vamos usar um gerenciador de arquivos (GoogleAIFileManager) que já vem junto com o pacote oficial do Google para Node.js.2. Preparando o Ambiente (Instalação)No terminal, dentro da pasta do seu projeto Node.js, certifique-se de que você tem os pacotes oficiais instalados atualizados. Execute:npm install @google/generative-ai @google/generative-ai/server
@google/generative-ai: É a biblioteca principal para conversar com o Gemini.@google/generative-ai/server: É a biblioteca que contém o GoogleAIFileManager, responsável por fazer o upload do PDF (ela é específica para rodar no backend/servidor Node.js).3. O Código Completo (leitor_pdf.js)Crie um novo arquivo chamado leitor_pdf.js e cole o código abaixo. Leia os comentários no código para entender exatamente o que está acontecendo:// Importamos a IA e o Gerenciador de Arquivos do Google
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Coloque sua chave de API aqui (A MESMA que você já usa!)
const apiKey = "COLOQUE_SUA_CHAVE_DE_API_AQUI"; 

// Inicializamos as duas ferramentas usando a mesma chave
const ai = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

async function extrairDadosDoPDF() {
    try {
        console.log("1. Iniciando o upload do PDF para o Google...");
        
        // PASSO A: Fazendo o upload do arquivo
        // Substitua 'caminho/para/seu/arquivo.pdf' pelo local real do seu PDF
        const uploadResult = await fileManager.uploadFile("caminho/para/seu/arquivo.pdf", {
            mimeType: "application/pdf",
            displayName: "Documento Analise", // Um nome amigável (opcional)
        });
        
        console.log(`Upload concluído com sucesso! URI gerada: ${uploadResult.file.uri}`);

        // PASSO B: Configurando o modelo Gemini 2.5 Flash
        console.log("2. Chamando o Gemini 2.5 Flash para ler o documento...");
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

        // PASSO C: Enviando o arquivo carregado + a sua instrução (prompt)
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            "Você é um excelente extrator de dados. Analise este PDF e me diga quais são as informações principais. Retorne os dados organizados."
        ]);

        // Exibindo a resposta final!
        console.log("\n--- Resposta da IA ---");
        console.log(result.response.text());

        // PASSO D (Opcional): Limpando a casa
        // É uma boa prática deletar o arquivo do servidor do Google depois de usar
        await fileManager.deleteFile(uploadResult.file.name);
        console.log("\n(Arquivo temporário deletado dos servidores do Google)");

    } catch (error) {
        console.error("Erro durante o processo:", error);
    }
}

// Executa a função
extrairDadosDoPDF();
4. Por que esse método funciona perfeitamente?Adeus Base64: O arquivo não é mais transformado numa "sopa de letrinhas" gigantesca de texto.Visão Espacial: Quando o Google recebe o PDF via uploadFile, o Gemini 2.5 Flash consegue "enxergar" o documento. Se tiver uma tabela no canto direito, ele sabe que é uma tabela e onde ela está.Economia de Tokens: Como você não está enviando milhões de caracteres de texto Base64 no prompt, a IA responde muito mais rápido e não se perde no meio do caminho.5. Dica de OuroSe os seus PDFs forem muito grandes (mais de 20 páginas), pode levar alguns segundos para o Google processar o arquivo logo após o upload. Se o código falhar dizendo que o arquivo não está pronto, você pode precisar colocar um pequeno setTimeout (esperar uns 5 segundos) entre o Passo A e o Passo C. Mas para PDFs normais de 1 a 5 páginas, o código acima roda perfeitamente de forma instantânea!