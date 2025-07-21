import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY;

// Função para converter o arquivo para o formato da IA
async function fileToGenerativePart(file) {
  const base64EncodedData = Buffer.from(await file.arrayBuffer()).toString('base64');
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}

export async function POST(request) {
  if (!apiKey) {
    return NextResponse.json({ error: "A chave da API de IA não está configurada no servidor." }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const prompt = formData.get('prompt');

    if (!file || !prompt) {
      return NextResponse.json({ error: 'Arquivo e prompt são obrigatórios.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imagePart = await fileToGenerativePart(file);
    
    // Adiciona uma instrução final para garantir que a resposta seja sempre um JSON
    const fullPrompt = `${prompt}. Responda APENAS com um objeto JSON válido, sem nenhum texto adicional, markdown ou formatação. Se alguma informação não for encontrada, retorne um valor nulo para a chave correspondente.`;

    const result = await model.generateContent([fullPrompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    // Limpa a resposta para garantir que seja um JSON válido
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonData = JSON.parse(text);

    return NextResponse.json(jsonData, { status: 200 });

  } catch (error) {
    console.error('Erro na rota da API de análise de empreendimento:', error);
    return NextResponse.json({ error: `Ocorreu um erro ao processar o arquivo: ${error.message}` }, { status: 500 });
  }
}