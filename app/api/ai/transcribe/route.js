import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não configurada" }), { status: 500 });
    }

    const { audioBase64, mimeType } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Áudio ausente" }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using 2.5-flash for audio

    const prompt = "Transcreva fielmente o áudio para pt-BR. Retorne APENAS o texto transcrito, sem aspas, sem introduções e sem formatações adicionais. Se não entender nada, retorne vazio.";
    
    // O base64 vindo do front-end costuma vir com ou sem prefixo. Removemos prefixo se houver.
    const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || "audio/webm"
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text().trim();

    return new Response(JSON.stringify({ text: responseText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Transcrição:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
