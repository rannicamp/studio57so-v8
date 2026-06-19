// utils/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Instância única para evitar recriação e economizar conexões
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Tabela de preços atualizada por milhão de tokens (USD)
const PRICING_TABLE = {
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
  'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.50 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-3.1-pro': { input: 2.00, output: 12.00 },
  'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-3.5-flash': { input: 1.50, output: 9.00 }
};

/**
 * Wrapper de geração de conteúdo do Gemini com registro automático de telemetria e custo no Supabase (app_logs).
 * 
 * @param {Object} params
 * @param {string} params.modelName - O nome do modelo a ser utilizado (ex: 'gemini-3.1-pro-preview')
 * @param {Array|string} params.promptContent - Conteúdo do prompt (pode ser texto ou array com mídias inline)
 * @param {Object} [params.generationConfig] - Configurações opcionais da chamada (ex: responseSchema)
 * @param {string} params.origem - Nome do módulo ou rota que originou a chamada (ex: '/api/ai/chat-analysis')
 * @param {string} params.context - Finalidade específica da chamada (ex: 'Sugestão de Resposta')
 * @param {string|number} [params.contatoId] - ID do contato associado para correlação no CRM
 * @param {string|number} [params.organizacaoId] - ID da organização ativa
 * @param {string} [params.usuarioId] - ID do usuário humano que realizou a ação
 * @returns {Promise<Object>} - Retorna o resultado bruto da API do Gemini
 */
export async function generateContentWithTelemetry({
  modelName,
  promptContent,
  generationConfig = {},
  origem = 'GEMINI TELEMETRY',
  context = 'Chamada Geral',
  contatoId = null,
  organizacaoId = null,
  usuarioId = null
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Chave GEMINI_API_KEY não configurada no servidor.');
  }

  // Se o modelo passado for nulo ou vazio, define fallback para o flash leve
  const modelToUse = modelName || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({ model: modelToUse, generationConfig });
  
  const startTime = Date.now();
  let result = null;
  let errorMsg = null;
  let success = false;
  
  try {
    console.log(`[Gemini Telemetry] Disparando chamada para ${modelToUse} | Origem: ${origem} | Contexto: ${context}...`);
    result = await model.generateContent(promptContent);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err.message || err.toString();
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    
    // Roda em background de forma totalmente assíncrona para não bloquear a thread principal
    (async () => {
      try {
        const usageMetadata = result?.response?.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        
        // Calcula o custo com base no modelo
        const rates = PRICING_TABLE[modelToUse] || PRICING_TABLE['gemini-2.5-flash'];
        const inputCost = inputTokens * (rates.input / 1000000);
        const outputCost = outputTokens * (rates.output / 1000000);
        const costUSD = parseFloat((inputCost + outputCost).toFixed(8));
        
        const logMessage = success
          ? `Custo Gemini (${modelToUse}) - ${origem} (${context}): $${costUSD.toFixed(6)} USD (Tokens: ${inputTokens} entrada / ${outputTokens} saída | Duração: ${durationMs}ms)`
          : `Falha Gemini (${modelToUse}) - ${origem} (${context}) após ${durationMs}ms. Erro: ${errorMsg}`;

        // Inserir log detalhado na tabela app_logs
        await supabaseAdmin.from('app_logs').insert({
          origem: 'GEMINI COST',
          mensagem: logMessage,
          payload: {
            success,
            origem_chamada: origem,
            contexto: context,
            modelo: modelToUse,
            duration_ms: durationMs,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: success ? costUSD : 0,
            contato_id: contatoId ? Number(contatoId) : null,
            usuario_id: usuarioId || null,
            organizacao_id: organizacaoId ? Number(organizacaoId) : 1,
            error: errorMsg
          },
          organizacao_id: organizacaoId ? Number(organizacaoId) : 1,
          usuario_id: usuarioId || null
        });
        
        console.log(`[Gemini Telemetry Logged] ${logMessage}`);
      } catch (logErr) {
        console.error('[Gemini Telemetry Logger Error] Erro ao tentar salvar telemetria no banco:', logErr.message || logErr);
      }
    })();
  }
}
