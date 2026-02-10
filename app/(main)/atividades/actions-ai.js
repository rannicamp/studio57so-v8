'use server'

import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

// --- FUNÇÃO DE LIMPEZA BLINDADA ---
function cleanJsonOutput(text) {
  if (!text) return []
  try {
    return JSON.parse(text)
  } catch (e) {
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1) {
      const jsonCandidate = text.substring(firstBracket, lastBracket + 1)
      try { return JSON.parse(jsonCandidate) } catch (e2) { return [] }
    }
    return []
  }
}

export async function generateActivityPlan(userMessage, organizacaoId, currentPlan = null) {
  if (!genAI) return { success: false, message: 'Erro: Chave API não configurada.' }

  const supabase = await createClient()

  try {
    const { data: contextData } = await supabase.rpc('get_ai_context_data', { p_organizacao_id: organizacaoId })
    const safeContext = contextData || { empreendimentos: [], funcionarios: [], etapas: [], tipos_atividade: [] }

    let systemPrompt = ''

    // Prompt Base (Comum para Criação e Edição)
    const baseRules = `
      REGRAS DE OBRAS E PESSOAS:
      1. Se falar "Obra X", ache o ID em OBRAS: ${JSON.stringify(safeContext.empreendimentos)}.
      2. Se falar "João", ache o ID em EQUIPE: ${JSON.stringify(safeContext.funcionarios)}.
      
      REGRAS CRÍTICAS DE FORMATAÇÃO:
      1. O campo 'status' deve ser SEMPRE "Não Iniciado" (Com N e I maiúsculos).
      2. Retorne APENAS JSON Array. Sem markdown.
      3. Use 'temp_id' e 'parent_temp_id' para hierarquia.
    `

    if (currentPlan && Array.isArray(currentPlan) && currentPlan.length > 0) {
      // --- MODO EDIÇÃO ---
      systemPrompt = `
        ATUE COMO: Gerente de Projetos Sênior.
        TAREFA: Atualizar JSON de atividades.
        
        JSON ATUAL: ${JSON.stringify(currentPlan)}
        PEDIDO: "${userMessage}"
        
        ${baseRules}
      `
    } else {
      // --- MODO CRIAÇÃO ---
      systemPrompt = `
        ATUE COMO: Gerente de Projetos Sênior.
        TAREFA: Criar plano de obras em JSON.
        DATA BASE: ${new Date().toLocaleDateString('pt-BR')}
        
        CONTEXTO ADICIONAL:
        Etapas: ${JSON.stringify(safeContext.etapas)}
        Tipos: ${JSON.stringify(safeContext.tipos_atividade)}
        
        ${baseRules}
        
        MODELO: [{ "temp_id": 1, "nome": "...", "status": "Não Iniciado", "parent_temp_id": null }]
      `
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      generationConfig: { temperature: 1.0 }
    })

    const result = await model.generateContent(systemPrompt + `\n\nPEDIDO DO USUÁRIO: "${userMessage}"`)
    let activities = cleanJsonOutput(result.response.text())
    
    if (!activities || activities.length === 0) return { success: false, message: 'Falha ao gerar plano.' }
    if (!Array.isArray(activities)) activities = [activities]
    
    // GARANTIA EXTRA: Força o status correto via código antes de devolver
    activities = activities.map(a => ({ ...a, status: 'Não Iniciado' }))
    
    return { success: true, data: activities }

  } catch (error) {
    console.error('Erro IA:', error)
    return { success: false, message: 'Erro de processamento.' }
  }
}

export async function confirmActivityPlan(activities, organizacaoId, usuarioId) {
  const supabase = await createClient()
  const idMap = {}
  let totalSaved = 0

  const parents = activities.filter(a => !a.parent_temp_id)
  const children = activities.filter(a => a.parent_temp_id)

  try {
    for (const activity of parents) {
      const { data, error } = await supabase.from('activities').insert({
        ...formatForDb(activity, organizacaoId, usuarioId),
        atividade_pai_id: null
      }).select('id').single()

      if (error) throw error
      if (activity.temp_id) idMap[activity.temp_id] = data.id
      totalSaved++
    }

    for (const activity of children) {
      const realParentId = idMap[activity.parent_temp_id]
      const { error } = await supabase.from('activities').insert({
        ...formatForDb(activity, organizacaoId, usuarioId),
        atividade_pai_id: realParentId || null
      })
      if (error) throw error
      totalSaved++
    }

    return { success: true, count: totalSaved }
  } catch (error) {
    console.error('Erro Save:', error)
    throw new Error('Erro ao salvar atividades.')
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
    status: 'Não Iniciado', // <--- FORÇADO AQUI TAMBÉM
    empreendimento_id: activity.empreendimento_id || null,
    funcionario_id: activity.funcionario_id || null,
    responsavel_texto: activity.responsavel_texto || null,
    organizacao_id: orgId,
    criado_por_usuario_id: userId
  }
}

// ... (código existente generateActivityPlan e confirmActivityPlan) ...

// --- NOVAS FUNÇÕES DE PERSISTÊNCIA ---

/**
 * Busca a última sessão ativa do usuário ou cria uma nova
 */
export async function getOrCreateSession(organizacaoId, usuarioId) {
  const supabase = await createClient()
  
  // Tenta pegar a última sessão editada
  const { data: existingSession } = await supabase
    .from('ai_planning_sessions')
    .select('*')
    .eq('organizacao_id', organizacaoId)
    .eq('user_id', usuarioId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (existingSession) {
    return { success: true, session: existingSession }
  }

  // Se não existir, cria uma zerada
  const { data: newSession, error } = await supabase
    .from('ai_planning_sessions')
    .insert({
      organizacao_id: organizacaoId,
      user_id: usuarioId,
      title: 'Novo Planejamento',
      messages: [{ role: 'ai', content: 'Olá! Recuperamos seu histórico. O que vamos planejar hoje?' }],
      current_plan: null
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar sessão:', error)
    return { success: false, message: 'Erro ao iniciar sessão.' }
  }

  return { success: true, session: newSession }
}

/**
 * Salva o estado atual do chat (Mensagens + Plano)
 */
export async function saveSessionState(sessionId, messages, currentPlan) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('ai_planning_sessions')
    .update({
      messages: messages,
      current_plan: currentPlan,
      updated_at: new Date()
    })
    .eq('id', sessionId)

  if (error) console.error('Erro ao salvar sessão:', error)
}

/**
 * Limpa a sessão (Reseta para começar do zero)
 */
export async function clearSession(sessionId) {
  const supabase = await createClient()
  
  await supabase
    .from('ai_planning_sessions')
    .update({
      messages: [{ role: 'ai', content: 'Planejamento reiniciado. Como posso ajudar?' }],
      current_plan: null
    })
    .eq('id', sessionId)
}