// app/api/ai/agent-tasks/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não configurada" }), { status: 500 });
    }

    const body = await req.json();
    const { messages, contextData, today, currentPlan } = body;

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // SCHEMA: Forçamos a estrutura exata que o banco espera para Eventos vs Tarefas
    const schema = {
      description: "Plano de ação para criação de atividades e eventos",
      type: "object",
      properties: {
        thought_process: { type: "string", description: "Analise: O usuário quer um Evento (hora marcada) ou Tarefa (duração em dias)?" },
        clarification_needed: { type: "boolean", description: "True se faltar a HORA para um Evento." },
        question_to_user: { type: "string", description: "A pergunta caso falte a hora." },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              temp_id: { type: "integer" },
              
              // TIPO: A decisão mais importante
              tipo_atividade: { type: "string", enum: ["Evento", "Tarefa"] },
              
              nome: { type: "string" },
              descricao: { type: "string" },
              status: { type: "string", enum: ["Não Iniciado"], default: "Não Iniciado" },
              
              // DATA (Comum a ambos)
              data_inicio_prevista: { type: "string", description: "YYYY-MM-DD" },
              
              // CAMPOS EXCLUSIVOS DE EVENTO (Hora Marcada)
              hora_inicio: { type: "string", description: "HH:MM:SS - OBRIGATÓRIO PARA EVENTOS. Null para Tarefas." },
              duracao_horas: { type: "number", description: "Duração em horas (ex: 1, 2.5). OBRIGATÓRIO PARA EVENTOS." },
              
              // CAMPOS EXCLUSIVOS DE TAREFA (Dias de Obra)
              duracao_dias: { type: "number", description: "Duração em dias (ex: 1, 3, 0.5). OBRIGATÓRIO PARA TAREFAS. Para Eventos envie 0." },

              // Vínculos
              empreendimento_id: { type: "integer", nullable: true },
              funcionario_id: { type: "string", nullable: true },
              responsavel_texto: { type: "string", nullable: true },
              parent_temp_id: { type: "integer", nullable: true }
            },
            required: ["nome", "tipo_atividade", "data_inicio_prevista"]
          }
        }
      },
      required: ["thought_process", "clarification_needed", "activities"]
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
      systemInstruction: `
        VOCÊ É UM ASSISTENTE DE GESTÃO DO STUDIO 57.
        Data de hoje: ${today}

        SUA MISSÃO É DISTINGUIR "EVENTOS" DE "TAREFAS". SÃO COISAS DIFERENTES.

        --- MODO 1: EVENTO (Compromisso na Agenda) ---
        - Gatilhos: "Reunião", "Visita", "Vistoria", "Almoço", "Call", "Encontro", ou se o usuário disser uma HORA (ex: "às 14h").
        - Regras:
          1. Defina 'tipo_atividade': "Evento".
          2. **OBRIGATÓRIO:** Preencha 'hora_inicio' (HH:MM). Se o usuário não disse a hora, marque 'clarification_needed': true e PERGUNTE.
          3. 'duracao_horas': Padrão 1.
          4. 'duracao_dias': DEVE SER 0. Eventos não duram dias no cronograma, duram horas.

        --- MODO 2: TAREFA (Serviço de Obra/Escritório) ---
        - Gatilhos: "Pintar", "Comprar", "Instalar", "Ligar para", "Enviar e-mail", "Fazer relatório".
        - Regras:
          1. Defina 'tipo_atividade': "Tarefa".
          2. 'hora_inicio': DEVE SER null. Tarefas não têm hora marcada, são do dia.
          3. 'duracao_dias': Padrão 1. Use 0.5 para meio dia.
          4. 'duracao_horas': DEVE SER null.

        --- CONTEXTO DO BANCO ---
        Obras Disponíveis: ${JSON.stringify(contextData.empreendimentos || [])}
        Funcionários: ${JSON.stringify(contextData.funcionarios || [])}

        --- RESPONSÁVEL ---
        - Se não citado nome, use 'funcionario_id': "SELF".
        - Se citado, busque o ID.
      `
    });

    const lastUserMessage = messages[messages.length - 1].content;
    let prompt = lastUserMessage;

    if (currentPlan) {
      prompt = `EDITE este plano existente com base no pedido: "${lastUserMessage}". Plano Atual: ${JSON.stringify(currentPlan)}`;
    }

    const result = await model.generateContent(prompt);
    return new Response(result.response.text(), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro no Agente:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}