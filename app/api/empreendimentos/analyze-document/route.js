import { GoogleGenerativeAI } from '@google/generative-ai';

// Função para converter o arquivo em um formato que a IA entende
async function fileToGenerativePart(file) {
  const base64EncodedData = Buffer.from(await file.arrayBuffer()).toString('base64');
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const prompt = formData.get('prompt');

    if (!file) {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo enviado.' }), { status: 400 });
    }
    if (!prompt) {
        return new Response(JSON.stringify({ error: 'Nenhum prompt fornecido.' }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imagePart = await fileToGenerativePart(file);

    const fullPrompt = `${prompt}. Responda APENAS com um objeto JSON válido, sem nenhum texto adicional ou formatação. Exemplo de resposta: {"chave": "valor", "outra_chave": "outro_valor"}. Se alguma informação não for encontrada, retorne um valor nulo para a chave correspondente.`;

    const result = await model.generateContent([fullPrompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    // Limpa a resposta da IA para garantir que seja um JSON válido
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      // Tenta fazer o parse do JSON. Se funcionar, retorna.
      const jsonData = JSON.parse(text);
      return new Response(JSON.stringify(jsonData), { status: 200 });
    } catch (e) {
      // Se o parse falhar, significa que a IA não retornou um JSON.
      console.error("Erro de parse do JSON da IA:", text);
      // Retorna um JSON de erro válido para o frontend não quebrar.
      return new Response(JSON.stringify({ error: "A IA não conseguiu extrair os dados em formato válido. Tente novamente ou com outro documento." }), { status: 500 });
    }

  } catch (error) {
    console.error('Erro na rota da API:', error);
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro no servidor.' }), { status: 500 });
  }
}