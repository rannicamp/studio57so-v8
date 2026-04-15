"use server";
// utils/firecrawlIndicesApi.js
import FirecrawlApp from '@mendable/firecrawl-js';

// Inicialização segura - Caso a API Key não esteja explícita no construtor, 
// a lib buscará automaticamente do process.env.FIRECRAWL_API_KEY
const app = new FirecrawlApp();

/**
 * Raspa a página oficial do portal IBRE da FGV em busca da última divulgação do INCC-M.
 * Traz a data e a hora EXATAS para garantir a conformidade da auditoria.
 * @returns {Promise<{
 *   nome_indice: string, 
 *   mes_ano: string, 
 *   data_referencia: string,
 *   valor_mensal: number,
 *   data_divulgacao_oficial: string,
 *   descricao: string
 * }|null>}
 */
export async function buscarUltimoInccFgv() {
  try {
    const url = "https://portalibre.fgv.br/incc-m";

    console.log("[Firecrawl] Iniciando varredura na FGV IBRE (INCC-M)...");
    
    // O recurso Extract instrui o LLM nativo do Firecrawl a encontrar as variáveis.
    const extractResult = await app.extract([url], {
      prompt: "Identifique no texto o último Índice Nacional de Custo da Construção (INCC-M) que foi divulgado oficialmente. Você precisa pegar a porcentagem (variacao mensal), o mês de referência (ex. 'Março de 2026'), e fundamentalmente a DATA e HORA EXATA da publicação/atualização na página.",
      schema: {
        type: "object",
        properties: {
          mes_ano: {
            type: "string", 
            description: "Mês e ano da publicação do índice, formato MM/YYYY. Exemplo: '03/2026'."
          },
          data_referencia: {
            type: "string",
            description: "A data de referência do mês avaliado no formato YYYY-MM-DD. Exemplo: '2026-03-01'."
          },
          valor_mensal: {
            type: "number",
            description: "Variação mensal revelada (em porcentagem, sem o sinal de %). Exemplo: 0.36"
          },
          data_divulgacao_oficial: {
            type: "string",
            description: "A data e HORA cravadas de quando essa publicação oficial foi colocada no ar (Timestamp ISO ou String clara). Exemplo: '2026-03-26T08:00:00-03:00' ou '26 de Março de 2026 às 08:00'"
          }
        },
        required: ["mes_ano", "data_referencia", "valor_mensal", "data_divulgacao_oficial"]
      }
    });

    if (!extractResult || !extractResult.success || !extractResult.data) {
      console.warn("[Firecrawl] Falhou ou nenhuma extração pôde ser feita.", extractResult?.error);
      return null;
    }

    const { mes_ano, data_referencia, valor_mensal, data_divulgacao_oficial } = extractResult.data;

    if (valor_mensal === undefined || !mes_ano) {
       return null;
    }

    return {
      nome_indice: "INCC",
      mes_ano: mes_ano,
      data_referencia: data_referencia,
      valor_mensal: parseFloat(valor_mensal),
      data_divulgacao_oficial: data_divulgacao_oficial,
      descricao: `Validação Oficial FGV IBRE capturada por IA em tempo real.`
    };

  } catch (error) {
    console.error("[Firecrawl Api] Erro crítico na busca do portalibre:", error);
    return null;
  }
}
