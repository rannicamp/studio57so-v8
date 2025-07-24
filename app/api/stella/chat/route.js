// /app/api/stella/chat/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    // ... (outras configurações de segurança)
];

export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const { messages, empreendimentoId } = await request.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "Nenhuma mensagem fornecida." }, { status: 400 });
        }
        
        // A última mensagem é a pergunta atual do usuário
        const userQuestion = messages[messages.length - 1].content;

        // 1. Buscar informações nos documentos
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const resultEmbedding = await embeddingModel.embedContent(userQuestion);
        const embedding = resultEmbedding.embedding.values;

        const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_documento_empreendimento', {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 7, // Aumentamos a quantidade de trechos para respostas mais completas
            p_empreendimento_id: empreendimentoId
        });

        if (rpcError) {
            console.error("[STELLA-CHAT-API] Erro ao buscar nos documentos:", rpcError);
            return NextResponse.json({ error: "Erro ao consultar a base de conhecimento." }, { status: 500 });
        }

        const contextText = chunks && chunks.length > 0
            ? chunks.map((c, i) => `Fonte ${i+1}:\n${c.content}`).join('\n\n---\n\n')
            : "Nenhuma informação específica encontrada nos documentos sobre este tópico.";
        
        // 2. Montar o Prompt Avançado
        const systemPrompt = `
          Você é a Stella, uma assistente de sistema especialista. Sua função é ajudar os usuários a entenderem e utilizarem o sistema, respondendo a perguntas com base em uma base de conhecimento de documentos.
          
          REGRAS:
          1.  **Seja Precisa:** Suas respostas devem ser baseadas estritamente no "CONTEXTO DOS DOCUMENTOS" fornecido.
          2.  **Seja Útil:** Responda à pergunta do usuário de forma clara e direta. Se o contexto fornecer uma resposta, elabore-a de forma útil.
          3.  **Quando Não Souber:** Se o contexto não contiver a resposta, seja honesta. Responda com algo como: "Não encontrei informações sobre isso em nossa base de conhecimento. Você poderia tentar reformular a pergunta?".
          4.  **Mantenha o Foco:** Não responda a perguntas que não sejam relacionadas ao sistema ou aos empreendimentos.

          ---
          CONTEXTO DOS DOCUMENTOS:
          ${contextText}
          ---
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
            systemInstruction: systemPrompt,
        });
        
        // Prepara o histórico para o modelo
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(userQuestion);
        const response = result.response;
        const responseText = response.text();

        return NextResponse.json({ response: responseText });

    } catch (error) {
        console.error("[STELLA-CHAT-API] Erro inesperado:", error);
        return NextResponse.json({ error: "Ocorreu um erro no servidor da IA." }, { status: 500 });
    }
}