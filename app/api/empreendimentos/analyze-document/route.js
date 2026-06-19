import { NextResponse } from 'next/server';
import { generateContentWithTelemetry } from '@/utils/gemini';

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
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const prompt = formData.get('prompt');

    if (!file || !prompt) {
      return NextResponse.json({ error: 'Arquivo e prompt são obrigatórios.' }, { status: 400 });
    }

    const imagePart = await fileToGenerativePart(file);
    // Adiciona uma instrução final para garantir que a resposta seja sempre um JSON
    const fullPrompt = `${prompt}. Responda APENAS com um objeto JSON válido, sem nenhum texto adicional, markdown ou formatação. Se alguma informação não for encontrada, retorne um valor nulo para a chave correspondente.`;

    const result = await generateContentWithTelemetry({
      modelName: "gemini-3.1-flash-lite",
      promptContent: [fullPrompt, imagePart],
      origem: '/api/empreendimentos/analyze-document',
      context: 'Análise de Documento de Venda'
    });

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