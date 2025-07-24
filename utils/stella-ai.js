// utils/stella-ai.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("ERRO CRÍTICO: A variável GEMINI_API_KEY não foi encontrada no ambiente para Stella AI.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- FUNÇÕES DE ACESSO AO BANCO DE DADOS PARA A IA ---
// Essas funções simulam o acesso ao banco de dados e serão chamadas pela IA via Function Calling.

async function get_empreendimentos(supabase, { nome_empreendimento = null, status = null }) {
    let query = supabase.from('empreendimentos').select('*');
    if (nome_empreendimento) {
        query = query.ilike('nome', `%${nome_empreendimento}%`);
    }
    if (status) {
        query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) {
        console.error('Erro ao buscar empreendimentos:', error);
        return { error: 'Falha ao buscar empreendimentos.' };
    }
    return { empreendimentos: data };
}

async function get_funcionarios(supabase, { full_name = null, contract_role = null, status = null }) {
    let query = supabase.from('funcionarios').select('id, full_name, contract_role, phone, email, status');
    if (full_name) {
        query = query.ilike('full_name', `%${full_name}%`);
    }
    if (contract_role) {
        query = query.ilike('contract_role', `%${contract_role}%`);
    }
    if (status) {
        query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) {
        console.error('Erro ao buscar funcionários:', error);
        return { error: 'Falha ao buscar funcionários.' };
    }
    return { funcionarios: data };
}

async function get_lancamentos(supabase, { tipo = null, data_inicio = null, data_fim = null, categoria = null, empreendimento_id = null }) {
    let query = supabase.from('lancamentos').select(`
        id, descricao, valor, data_transacao, tipo, status,
        categorias_financeiras(nome),
        empreendimentos(nome)
    `);
    if (tipo) {
        query = query.eq('tipo', tipo);
    }
    if (data_inicio) {
        query = query.gte('data_transacao', data_inicio);
    }
    if (data_fim) {
        query = query.lte('data_transacao', data_fim);
    }
    // Supondo que a categoria venha como nome para a IA e precisamos buscar o ID
    if (categoria) {
        const { data: categoriaData, error: catError } = await supabase
            .from('categorias_financeiras')
            .select('id')
            .ilike('nome', `%${categoria}%`)
            .single();
        if (categoriaData) {
            query = query.eq('categoria_id', categoriaData.id);
        } else {
            console.warn(`Categoria "${categoria}" não encontrada. Ignorando filtro de categoria.`);
        }
    }
    if (empreendimento_id) {
        query = query.eq('empreendimento_id', empreendimento_id);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Erro ao buscar lançamentos:', error);
        return { error: 'Falha ao buscar lançamentos.' };
    }
    return { lancamentos: data };
}

// Mapeamento de nomes de funções para as implementações reais
const availableFunctions = {
    get_empreendimentos,
    get_funcionarios,
    get_lancamentos,
};

// --- O "CÉREBRO" DA STELLA: FUNÇÃO QUE ANALISA E RESPONDE ---

export async function processStellaChatMessage(supabase, messageText, chatHistory) {
  if (!genAI) {
    return "Desculpe, a inteligência artificial não está configurada corretamente no momento.";
  }

  const systemInstruction = `
      Você é a Stella, uma assistente virtual do Studio 57, especializada em responder perguntas sobre os dados da empresa.
      Você tem acesso a informações sobre empreendimentos, funcionários, e lançamentos financeiros.
      Sua principal tarefa é ajudar os usuários a obterem insights e informações do sistema.

      Regras:
      1.  Responda de forma clara, concisa e profissional.
      2.  Se uma pergunta puder ser respondida usando os dados do banco de dados (através das ferramentas disponíveis), priorize o uso das ferramentas.
      3.  Ao usar uma ferramenta, você deve primeiro formular a chamada da função e depois, se a ferramenta retornar dados, resumir esses dados de forma útil para o usuário.
      4.  Se a pergunta estiver fora do seu escopo (ex: "Qual a capital da França?"), diga que você é especializada nos dados do Studio 57 e não pode responder.
      5.  Mantenha o contexto da conversa.
      6.  Formate suas respostas de forma legível, usando listas ou parágrafos quando apropriado.
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Modelo mais leve para chat geral
    safetySettings,
    systemInstruction,
    tools: {
      functionDeclarations: [
        {
          name: "get_empreendimentos",
          description: "Obtém informações sobre empreendimentos da empresa, como nome, status e endereço.",
          parameters: {
            type: "OBJECT",
            properties: {
              nome_empreendimento: { type: "STRING", description: "Nome ou parte do nome do empreendimento a ser buscado." },
              status: { type: "STRING", description: "Status do empreendimento (ex: 'Em Andamento', 'Concluído', 'Pendente')." }
            }
          }
        },
        {
          name: "get_funcionarios",
          description: "Obtém informações sobre funcionários da empresa, como nome completo, cargo, telefone, email e status.",
          parameters: {
            type: "OBJECT",
            properties: {
              full_name: { type: "STRING", description: "Nome completo ou parte do nome do funcionário." },
              contract_role: { type: "STRING", description: "Cargo do funcionário (ex: 'Engenheiro', 'Arquiteto', 'Pedreiro')." },
              status: { type: "STRING", description: "Status do funcionário (ex: 'Ativo', 'Inativo', 'Férias')." }
            }
          }
        },
        {
          name: "get_lancamentos",
          description: "Obtém lançamentos financeiros (receitas, despesas, transferências) com filtros por tipo, data, categoria e empreendimento.",
          parameters: {
            type: "OBJECT",
            properties: {
              tipo: { type: "STRING", description: "Tipo de lançamento (ex: 'Receita', 'Despesa', 'Transferência')." },
              data_inicio: { type: "STRING", format: "date", description: "Data de início para o período de busca (formato YYYY-MM-DD)." },
              data_fim: { type: "STRING", format: "date", description: "Data de fim para o período de busca (formato YYYY-MM-DD)." },
              categoria: { type: "STRING", description: "Nome da categoria financeira." },
              empreendimento_id: { type: "NUMBER", description: "ID do empreendimento associado ao lançamento." }
            }
          }
        }
      ]
    }
  });

  const chat = model.startChat({
    history: chatHistory.map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message_content }]
    })),
    // Não adicionar a mensagem atual ao histórico aqui, ela é passada separadamente
  });

  try {
    // Primeiro turno: IA tenta determinar se precisa de uma ferramenta
    const result = await chat.sendMessage(messageText);
    const response = result.response;

    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const functionName = call.name;
      const functionArgs = call.args;

      if (availableFunctions[functionName]) {
        console.log(`[Stella AI] Chamando função: ${functionName} com args:`, functionArgs);
        const toolResponse = await availableFunctions[functionName](supabase, functionArgs);
        console.log(`[Stella AI] Resposta da ferramenta:`, toolResponse);

        // Segundo turno: Enviar o resultado da ferramenta para a IA para gerar a resposta em linguagem natural
        const secondResult = await chat.sendMessage([
          {
            role: "user",
            parts: [{ text: messageText }]
          },
          {
            role: "model",
            parts: [{ functionCall: { name: functionName, args: functionArgs } }]
          },
          {
            role: "tool",
            parts: [{ functionResponse: { name: functionName, response: toolResponse } }]
          }
        ]);
        return secondResult.response.text();

      } else {
        return "Desculpe, não consigo executar essa operação no momento. Tente reformular sua pergunta.";
      }
    } else {
      // Se nenhuma função for chamada, a IA responde diretamente
      return response.text();
    }

  } catch (error) {
    console.error('Erro ao processar mensagem com Stella AI:', error);
    // Verificar se o erro é devido à chave de API inválida
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('API_KEY_NOT_CONFIGURED')) {
        return "Desculpe, há um problema com a configuração da minha chave de acesso. Por favor, avise o administrador do sistema.";
    }
    return "Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.";
  }
}