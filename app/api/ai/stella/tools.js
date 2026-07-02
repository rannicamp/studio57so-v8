// app/api/ai/stella/tools.js

// Especificação de ferramentas (Function Declarations) compatível com o SDK do Gemini do Google
export const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "fn_stella_obter_empreendimentos",
        description: "Obtém a lista de empreendimentos ativos da incorporadora Studio 57 que estão disponíveis e listados para venda.",
        parameters: {
          type: "OBJECT",
          properties: {},
        }
      },
      {
        name: "fn_stella_obter_dossie",
        description: "Obtém o dossiê oficial detalhado em Markdown de um empreendimento específico pelo seu ID. O dossiê contém diferenciais construtivos (laje nervurada, BIM), informações de localização, infraestrutura, segurança jurídica (matrículas no Cartório do 2º Ofício) e essência da marca.",
        parameters: {
          type: "OBJECT",
          properties: {
            empreendimento_id: {
              type: "INTEGER",
              description: "O ID do empreendimento desejado (ex: 1 para Residencial Alfa, 5 para Beta Suítes, 6 para Refúgio Braúnas)."
            }
          },
          required: ["empreendimento_id"]
        }
      },
      {
        name: "fn_stella_obter_estoque",
        description: "Consulta em tempo real o estoque de unidades livres de um empreendimento específico pelo seu ID, retornando as metragens (m²) e os valores vigentes de venda, garantindo informações comerciais 100% atualizadas.",
        parameters: {
          type: "OBJECT",
          properties: {
            empreendimento_id: {
              type: "INTEGER",
              description: "O ID do empreendimento desejado (ex: 1 para Residencial Alfa, 5 para Beta Suítes, 6 para Refúgio Braúnas)."
            }
          },
          required: ["empreendimento_id"]
        }
      },
      {
        name: "fn_stella_obter_anexos",
        description: "Retorna a lista de books, apresentações comerciais, tabelas e PDFs disponíveis para envio ao cliente do empreendimento selecionado pelo seu ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            empreendimento_id: {
              type: "INTEGER",
              description: "O ID do empreendimento desejado (ex: 1 para Residencial Alfa, 5 para Beta Suítes, 6 para Refúgio Braúnas)."
            }
          },
          required: ["empreendimento_id"]
        }
      }
    ]
  }
];

/**
 * Orquestrador que executa a chamada SQL correspondente no Supabase para a ferramenta acionada pelo Gemini.
 * 
 * @param {Object} params
 * @param {Object} params.supabaseAdmin - Cliente do Supabase com privilégios service_role
 * @param {number} params.organizacaoId - ID da organização ativa do contato
 * @param {string} params.functionName - Nome da função chamada pelo Gemini
 * @param {Object} params.functionArgs - Argumentos fornecidos pelo Gemini
 * @returns {Promise<any>} - O resultado retornado pelo banco de dados
 */
export async function executarToolStella({ supabaseAdmin, organizacaoId, functionName, functionArgs }) {
  console.log(`[Stella Tools] Executando tool SQL: ${functionName} com argumentos:`, functionArgs);
  
  try {
    if (functionName === "fn_stella_obter_empreendimentos") {
      const { data, error } = await supabaseAdmin.rpc("fn_stella_obter_empreendimentos", {
        p_organizacao_id: Number(organizacaoId)
      });
      if (error) throw error;
      return data || [];
    }

    if (functionName === "fn_stella_obter_dossie") {
      const { data, error } = await supabaseAdmin.rpc("fn_stella_obter_dossie", {
        p_empreendimento_id: Number(functionArgs.empreendimento_id),
        p_organizacao_id: Number(organizacaoId)
      });
      if (error) throw error;
      return { dossie: data || "Dossiê não encontrado." };
    }

    if (functionName === "fn_stella_obter_estoque") {
      const { data, error } = await supabaseAdmin.rpc("fn_stella_obter_estoque", {
        p_empreendimento_id: Number(functionArgs.empreendimento_id),
        p_organizacao_id: Number(organizacaoId)
      });
      if (error) throw error;
      return data || [];
    }

    if (functionName === "fn_stella_obter_anexos") {
      const { data, error } = await supabaseAdmin.rpc("fn_stella_obter_anexos", {
        p_empreendimento_id: Number(functionArgs.empreendimento_id),
        p_organizacao_id: Number(organizacaoId)
      });
      if (error) throw error;
      return data || [];
    }

    throw new Error(`Tool desconhecida ou não implementada no orquestrador: ${functionName}`);
  } catch (err) {
    console.error(`[Stella Tools Error] Erro ao executar a tool ${functionName}:`, err.message || err);
    return { error: err.message || err.toString() };
  }
}
