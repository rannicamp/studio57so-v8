'use server'

import { createClient } from '@/utils/supabase/server'
import { GoogleGenAI } from "@google/genai"

// --- CONFIGURAÇÃO ---
// Pode usar "gemini-2.0-flash" (Garantido) ou "gemini-3-pro-preview" (Se tiver acesso)
const MODELO_IA = "gemini-2.0-flash"; 

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// --- UTILITÁRIOS BLINDADOS ---

// 1. Extrai o texto de forma segura (funciona se for função OU propriedade)
function extractText(response) {
  try {
    if (!response) return "";
    // Se for função (SDK antiga ou alguns modelos)
    if (typeof response.text === 'function') {
      return response.text();
    }
    // Se for propriedade (SDK nova @google/genai em alguns casos)
    if (typeof response.text === 'string') {
      return response.text;
    }
    // Fallback: Tenta pegar direto dos candidatos (Estrutura bruta)
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      return response.candidates[0].content.parts.map(p => p.text).join('');
    }
    return JSON.stringify(response); // Último recurso
  } catch (e) {
    console.error("Erro ao extrair texto da resposta:", e);
    return "";
  }
}

// 2. Limpa o JSON (remove markdown)
function cleanJsonOutput(text) {
  if (!text) return null;
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(clean); } catch (e) { return null; }
}

// --- FERRAMENTA: BUSCAR NO BANCO (RPC) ---
async function searchActivitiesTool(criteria, organizacaoId) {
  console.log("🔍 [IA TOOL] Buscando no banco com critérios:", criteria);
  
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.rpc('buscar_atividades_ia', {
      p_organizacao_id: organizacaoId,
      p_termo_busca: criteria.termo || null,
      p_data_inicio: criteria.data_inicio || null,
      p_data_fim: criteria.data_fim || null,
      p_status: criteria.status || null
    });

    if (error) {
      console.error("❌ [IA TOOL] Erro na RPC:", error.message);
      return "Erro técnico ao consultar o banco de dados.";
    }

    if (!data || data.length === 0) {
      console.log("⚠️ [IA TOOL] Nenhum resultado encontrado.");
      return "Nenhuma atividade encontrada com esses filtros.";
    }

    console.log(`✅ [IA TOOL] Encontrados ${data.length} registros.`);
    
    // Formata uma string resumida para economizar tokens
    return data.map(a => 
      `• ID ${a.id} | ${a.atividade} | Status: ${a.status} | Data: ${new Date(a.data_inicio).toLocaleDateString()} | Resp: ${a.responsavel}`
    ).join("\n");

  } catch (err) {
    console.error("❌ [IA TOOL] Exceção:", err);
    return "Erro interno na ferramenta de busca.";
  }
}

// --- CÉREBRO PRINCIPAL (ROTEADOR) ---
export async function generateActivityPlan(userMessage, organizacaoId, currentPlan = null) {
  console.log("\n==========================================");
  console.log("🚀 [IA START] Recebido:", userMessage);
  
  if (!ai) {
    console.error("❌ [IA ERROR] Sem chave API.");
    return { type: 'message', message: "Erro: Chave API do Gemini não configurada." };
  }

  const supabase = await createClient();

  try {
    // 1. Contexto Rápido
    const { data: contextData } = await supabase.rpc('get_ai_context_data', { p_organizacao_id: organizacaoId });
    const safeContext = contextData || { empreendimentos: [], funcionarios: [] };

    // 2. Prompt de Decisão
    const decisionPrompt = `
      Você é um Assistente de Engenharia. Hoje é ${new Date().toLocaleDateString('pt-BR')}.
      
      CONTEXTO RÁPIDO:
      Obras: ${JSON.stringify(safeContext.empreendimentos)}
      
      MENSAGEM DO USUÁRIO: "${userMessage}"
      
      CLASSIFIQUE A INTENÇÃO E RETORNE APENAS O JSON:
      
      1. BUSCAR DADOS (listar, ver, consultar, o que tem pra fazer):
         Return: { "action": "SEARCH", "filters": { "termo": "...", "data_inicio": "YYYY-MM-DD", "status": "..." } }
      
      2. PLANEJAR/CRIAR (agendar, criar tarefa, fazer cronograma, editar plano):
         Return: { "action": "PLAN" }
      
      3. CONVERSA (oi, obrigado, dúvidas gerais):
         Return: { "action": "CHAT", "reply": "..." }
    `;

    console.log(`🤔 [IA DECISION] Consultando modelo ${MODELO_IA}...`);
    
    const decisionResponse = await ai.models.generateContent({
      model: MODELO_IA,
      contents: decisionPrompt,
      config: { responseMimeType: "application/json", temperature: 0.1 }
    });

    // CORREÇÃO AQUI: Usamos a função segura
    const decisionText = extractText(decisionResponse);
    console.log("💡 [IA DECISION] Resposta Raw:", decisionText);

    let decision = cleanJsonOutput(decisionText);
    
    // Se falhar o JSON, assume Chat
    if (!decision) {
      console.warn("⚠️ [IA DECISION] Falha no JSON, caindo para CHAT.");
      decision = { action: "CHAT", reply: "Não entendi bem. Pode repetir?" };
    }

    // --- ROTA 1: BUSCA ---
    if (decision.action === "SEARCH") {
      console.log("🔎 [IA ROUTE] Rota de BUSCA acionada.");
      
      // Chama a ferramenta (SQL)
      const dbResult = await searchActivitiesTool(decision.filters || {}, organizacaoId);
      
      // Pede pra IA resumir o resultado
      const finalResponse = await ai.models.generateContent({
        model: MODELO_IA,
        contents: `O usuário perguntou: "${userMessage}".
                   O banco de dados retornou isso:
                   ${dbResult}
                   
                   Responda ao usuário de forma amigável e resumida.`
      });

      return { type: 'message', message: extractText(finalResponse) };
    }

    // --- ROTA 2: CHAT ---
    if (decision.action === "CHAT") {
      console.log("💬 [IA ROUTE] Rota de CHAT acionada.");
      return { type: 'message', message: decision.reply || "Estou à disposição." };
    }

    // --- ROTA 3: PLANEJAMENTO (JSON COMPLEXO) ---
    if (decision.action === "PLAN") {
      console.log("🏗️ [IA ROUTE] Rota de PLANEJAMENTO acionada.");
      
      let planPrompt = `
        ATUE COMO: Gerente de Projetos Sênior.
        TAREFA: Gerar um JSON Array de atividades para: "${userMessage}".
        
        CONTEXTO:
        Obras (IDs reais): ${JSON.stringify(safeContext.empreendimentos)}
        Equipe (IDs reais): ${JSON.stringify(safeContext.funcionarios)}
        
        REGRAS RÍGIDAS:
        1. Retorne APENAS o JSON. Sem markdown.
        2. Use 'temp_id' (1, 2...) e 'parent_temp_id' para hierarquia (Pai/Filho).
        3. O campo 'status' DEVE SER "Não Iniciado".
        4. Tente vincular 'empreendimento_id' e 'funcionario_id' se encontrar nomes parecidos.
        
        FORMATO:
        [{ "temp_id": 1, "nome": "...", "status": "Não Iniciado", "parent_temp_id": null }]
      `;

      if (currentPlan) {
        planPrompt = `EDITE este plano JSON: ${JSON.stringify(currentPlan)}. PEDIDO: "${userMessage}". Mantenha formato JSON estrito.`;
      }

      const planResponse = await ai.models.generateContent({
        model: MODELO_IA,
        contents: planPrompt,
        config: { responseMimeType: "application/json", temperature: 0.8 }
      });

      const planText = extractText(planResponse);
      console.log("📦 [IA PLAN] JSON Gerado:", planText.substring(0, 100) + "..."); 

      let activities = cleanJsonOutput(planText);
      
      if (!activities) throw new Error("A IA não gerou um JSON válido.");
      if (!Array.isArray(activities)) activities = [activities];

      // Sanitização final
      activities = activities.map(a => ({ ...a, status: 'Não Iniciado' }));

      return { type: 'plan', data: activities };
    }

  } catch (error) {
    console.error("💥 [IA CRITICAL ERROR]", error);
    return { type: 'message', message: `Desculpe, tive um erro interno: ${error.message}` };
  }
}

// --- FUNÇÕES DE PERSISTÊNCIA (PARA O CHAT FUNCIONAR) ---

export async function listUserSessions(organizacaoId, usuarioId) {
  const supabase = await createClient();
  const { data } = await supabase.from('ai_planning_sessions')
    .select('id, title, updated_at')
    .eq('organizacao_id', organizacaoId)
    .eq('user_id', usuarioId)
    .order('updated_at', { ascending: false });
  return data || [];
}

export async function createNewSession(organizacaoId, usuarioId, title) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('ai_planning_sessions')
    .insert({
      organizacao_id: organizacaoId,
      user_id: usuarioId,
      title: title,
      messages: [{ role: 'ai', content: 'Olá! Estou pronto. Pode pedir para criar atividades ou consultar o banco.' }],
      current_plan: null
    }).select().single();
  
  if (error) return { success: false };
  return { success: true, session: data };
}

export async function getSessionById(sessionId) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('ai_planning_sessions').select('*').eq('id', sessionId).single();
  if (error) return { success: false };
  return { success: true, session: data };
}

export async function saveSessionState(sessionId, messages, currentPlan) {
  const supabase = await createClient();
  await supabase.from('ai_planning_sessions')
    .update({ messages, current_plan: currentPlan, updated_at: new Date() })
    .eq('id', sessionId);
}

export async function deleteSession(sessionId) {
  const supabase = await createClient();
  await supabase.from('ai_planning_sessions').delete().eq('id', sessionId);
}

export async function renameSession(sessionId, newTitle) {
  const supabase = await createClient();
  await supabase.from('ai_planning_sessions').update({ title: newTitle }).eq('id', sessionId);
}

export async function confirmActivityPlan(activities, organizacaoId, usuarioId) {
  const supabase = await createClient();
  const idMap = {};
  let totalSaved = 0;
  
  const parents = activities.filter(a => !a.parent_temp_id);
  const children = activities.filter(a => a.parent_temp_id);

  try {
    for (const activity of parents) {
      const { data, error } = await supabase.from('activities').insert(formatForDb(activity, organizacaoId, usuarioId)).select('id').single();
      if (error) throw error;
      if (activity.temp_id) idMap[activity.temp_id] = data.id;
      totalSaved++;
    }
    for (const activity of children) {
      const realParentId = idMap[activity.parent_temp_id];
      const { error } = await supabase.from('activities').insert({ ...formatForDb(activity, organizacaoId, usuarioId), atividade_pai_id: realParentId || null });
      if (error) throw error;
      totalSaved++;
    }
    return { success: true, count: totalSaved };
  } catch (error) {
    console.error("Erro ao salvar:", error);
    throw new Error('Erro de banco de dados.');
  }
}

function formatForDb(activity, orgId, userId) {
  return {
    nome: activity.nome,
    descricao: activity.descricao || '',
    tipo_atividade: activity.tipo_atividade || 'Geral',
    data_inicio_prevista: activity.data_inicio_prevista,
    data_fim_prevista: activity.data_inicio_prevista,
    duracao_dias: activity.duracao_dias || 1,
    status: 'Não Iniciado',
    empreendimento_id: activity.empreendimento_id || null,
    funcionario_id: activity.funcionario_id || null,
    responsavel_texto: activity.responsavel_texto || null,
    organizacao_id: orgId,
    criado_por_usuario_id: userId
  }
}