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
            total_invoice: { type: SchemaType.STRING },
            billing_period: { type: SchemaType.STRING },
            line_items: { 
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        description: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.STRING },
                        unit_price: { type: SchemaType.STRING },
                        amount: { type: SchemaType.STRING },
                        reason_for_charge: { type: SchemaType.STRING, description: "Explicação em português simples do porquê isso está sendo cobrado" }
                    }
                }
            },
            main_cost_driver: { type: SchemaType.STRING, description: "Qual é o principal vilão dessa fatura?" },
            recommendations_to_reduce_cost: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING, description: "Dicas práticas de como reduzir este custo no Netlify" }
            }
        },
        required: ["total_invoice", "billing_period", "line_items", "main_cost_driver", "recommendations_to_reduce_cost"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function readInvoice(filePath) {
    try {
        console.log("Fazendo upload do PDF para o Gemini...");
        const uploadResponse = await fileManager.uploadFile(filePath, {
            mimeType: "application/pdf",
            displayName: "Fatura Netlify",
        });
        
        console.log("PDF enviado. Analisando a fatura...");
        const prompt = "Você é um especialista em DevOps e faturamento Cloud. Analise esta fatura do Netlify. Identifique o período de cobrança, o valor total, e quebre cada item cobrado, explicando o que ele significa de forma leiga. Identifique o 'vilão' da fatura (o item mais caro) e sugira maneiras de reduzir os custos do Netlify.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const data = JSON.parse(result.response.text());
        console.log(JSON.stringify(data, null, 2));

        // Cleanup
        await fileManager.deleteFile(uploadResponse.file.name);
    } catch (e) {
        console.error("Erro na leitura IA: ", e.message);
    }
}

const pdfPath = "C:\\Users\\ranni\\OneDrive\\Área de Trabalho\\receipt-2026-04-12T00_59_57.072Z.pdf";
readInvoice(pdfPath);
