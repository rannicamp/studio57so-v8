import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Chave de API não configurada." }), { status: 500 });
    }

    const body = await req.json();
    const { messages } = body;

    // 1. Inicialização na biblioteca estável
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Instância do modelo
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        // Se precisar de configurações de sistema, use systemInstruction aqui se a versão permitir,
        // ou passe no history. O Gemini 2.0 Flash suporta systemInstruction.
    });

    console.log(`🤖 Conectando ao modelo: gemini-2.0-flash`);

    // Prepara o histórico (history) e a última mensagem
    // A lib estável separa o histórico da mensagem atual no método startChat,
    // mas para simplificar, vamos usar generateContentStream direto se for só prompt,
    // ou montar o chat. Abaixo, assumindo formato de chat:
    
    // Convertendo formato de mensagens do frontend para o formato do Google
    // O Google espera: { role: "user" | "model", parts: [{ text: "..." }] }
    const formattedHistory = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }] // Simplificação. Se tiver thoughtSignature no histórico, teria que tratar.
    }));

    const lastMessage = messages[messages.length - 1].content;

    // Inicia o chat
    const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
            temperature: 0.7,
        },
    });

    // 3. Gera o stream
    const result = await chat.sendMessageStream(lastMessage);

    // 4. Cria o ReadableStream para o frontend
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          // Na lib estável, iteramos sobre result.stream
          for await (const chunk of result.stream) {
            // AQUI O MÉTODO .text() FUNCIONA NATIVAMENTE
            const chunkText = chunk.text(); 
            
            // Tentativa de extrair thoughtSignature (se disponível no modelo e na lib)
            // Nota: Na versão estável atual, thoughtSignature pode vir dentro de parts,
            // mas o método .text() pega apenas o texto.
            let signature = null;
            
            // Acessando manualmente para buscar metadados extras se existirem
            const candidates = chunk.candidates || [];
            if (candidates[0]?.content?.parts) {
                for (const part of candidates[0].content.parts) {
                    if (part.thoughtSignature) {
                        signature = part.thoughtSignature;
                    }
                }
            }

            const payload = JSON.stringify({
              text: chunkText,
              thoughtSignature: signature
            }) + "\n";

            controller.enqueue(encoder.encode(payload));
          }
        } catch (err) {
          console.error("❌ Erro durante o streaming:", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });

  } catch (error) {
    console.error("💥 ERRO NO BACKEND:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}