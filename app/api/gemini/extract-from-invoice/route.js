import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("ERRO CRÍTICO: A variável GEMINI_API_KEY não foi encontrada no ambiente.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Função para converter o buffer do arquivo em uma parte de dados para a IA
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

export async function POST(request) {
  if (!genAI) {
    return NextResponse.json({ error: "A chave da API de IA não está configurada no servidor." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nenhum ficheiro enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imagePart = fileToGenerativePart(buffer, file.type);

    const prompt = `
      Você é um assistente financeiro especialista em ler faturas, notas fiscais e recibos.
      Analise a imagem a seguir e extraia as seguintes informações:
      1.  'valor': O valor total do documento. Retorne apenas números e ponto decimal (ex: 123.45).
      2.  'data_transacao': A data do documento no formato AAAA-MM-DD.
      3.  'descricao': Uma descrição curta e objetiva do que foi comprado ou do serviço prestado.
      4.  'nome_fornecedor': O nome da empresa ou pessoa que emitiu o documento.

      Responda APENAS com um objeto JSON válido, sem nenhum texto ou formatação adicional. Exemplo:
      {"valor": "150.75", "data_transacao": "2025-07-10", "descricao": "Almoço no Restaurante Sabor da Casa", "nome_fornecedor": "Restaurante Sabor da Casa LTDA"}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Limpa a resposta para garantir que seja um JSON válido
    const jsonResponse = JSON.parse(responseText.replace(/```json/g, "").replace(/```/g, "").trim());

    return NextResponse.json(jsonResponse, { status: 200 });

  } catch (error) {
    console.error("Erro na API de extração:", error);
    return NextResponse.json({ error: `Ocorreu um erro ao processar o ficheiro: ${error.message}` }, { status: 500 });
  }
}