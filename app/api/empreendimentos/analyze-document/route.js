import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("ERRO CRÍTICO: A variável de ambiente GEMINI_API_KEY não foi encontrada.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Função para converter o buffer do arquivo em um formato que a IA entende
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
    const prompt = formData.get("prompt"); // Pega o prompt enviado pelo formulário

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!prompt) {
        return NextResponse.json({ error: "O prompt de análise é obrigatório." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imagePart = fileToGenerativePart(buffer, file.type);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Limpa a resposta para garantir que seja um JSON válido, removendo ```json e ```
    const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonResponse = JSON.parse(cleanedText);

    return NextResponse.json(jsonResponse, { status: 200 });

  } catch (error) {
    console.error("Erro na API de análise de documento:", error);
    return NextResponse.json({ error: `Ocorreu um erro ao processar o documento: ${error.message}` }, { status: 500 });
  }
}
