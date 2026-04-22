---
name: Auditoria e Leitura de PDFs (Padrão Ouro Gemini)
description: Diretrizes obrigatórias de como a IA deve ler, interpretar e extrair dados de documentos PDF locais usando a API File do Gemini 2.5 Flash.
---

# 📖 Skill: Auditoria e Leitura de PDFs via IA

Sempre que o usuário solicitar que você "leia os PDFs", "verifique os documentos", "audite os PDFs" ou "extraia dados dos arquivos", você **DEVE, OBRIGATORIAMENTE, seguir este padrão arquitetural de extração**. 

Abandonamos a leitura primária via bibliotecas de OCR falhas (como `pdf-parse`) e saltamos diretamente para a **Auditoria Visual Nativa do Gemini 2.5 Flash**.

## 1. Regras de Ouro
1. **NUNCA use `gemini-1.5-flash`** (Causa erros 404 e Forbidden). Sempre chame `gemini-3.1`.
2. **USE a File API (`GoogleAIFileManager`)**: PDFs e imagens não devem ser convertidos para Base64 no prompt se forem grandes. O upload direto pela File API é a ponte segura.
3. **Mantenha Conformidade JSON**: Utilize `generationConfig` com `SchemaType` para blindar o retorno.

## 2. Template Padrão do Script Node.js 
Quando precisar extrair informações (ex: CNPJ, Categoria, Nome da Empresa) de múltiplos PDFs, escreva e execute silenciosamente um script Node seguindo exatamente a estrutura abaixo:

```javascript
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// Instanciação Padrão
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Blindagem JSON OBRIGATÓRIA
const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            chave_desejada: { type: SchemaType.STRING },
            status: { type: SchemaType.BOOLEAN },
            justificativa: { type: SchemaType.STRING }
        },
        required: ["chave_desejada", "status", "justificativa"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-3.1", generationConfig });

async function auditarPdf(caminhoArquivo) {
    try {
        // 1. Upload Seguro do PDF MimeType correto
        const uploadResponse = await fileManager.uploadFile(caminhoArquivo, {
            mimeType: "application/pdf",
            displayName: "Auditoria PDF",
        });
        
        // 2. Prompt Analítico Rigoroso
        const prompt = "Analise este documento e extraia X, Y e Z. Certifique-se de validar a veracidade...";

        // 3. Chamada Visual e de Texto simultânea
        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        return JSON.parse(result.response.text());
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}
```

## 3. Gestão de Rate Limits
- Ao processar pastas inteiras (Batch), sempre inclua um `delay(5000)` entre os arquivos para evitar o estouro de requisições por segundo (RPS) da API do Gemini.
- Descarte arquivos absurdamente grandes (ex: `stats.size > 15 * 1024 * 1024` ou seja > 15MB) pulando-os previamente via `fs`.

## 4. Quando NÃO aplicar esta Skill
- **Uploads Frontend**: Esta skill é apenas para scripts Node.js executados pela IA via terminal. Quando o sistema web Web necessitar extração pelo browser (ex: Faturas de Cartão IA), utilize a estrutura do `pdf.js` já montada pelo React no frontend do Financeiro.
