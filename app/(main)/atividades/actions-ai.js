'use server'

import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

// --- UTILITÁRIOS ---
function cleanJsonOutput(text) {
  if (!text) return []
  try { return JSON.parse(text) } catch (e) {
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1) {
      try { return JSON.parse(text.substring(firstBracket, lastBracket + 1)) } catch (e2) { return [] }
    }
    return []
  }
}

// --- GERENCIAMENTO DE SESSÕES (TIPO WHATSAPP) ---

export async function listUserSessions(organizacaoId, usuarioId) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_planning_sessions')
    .select('id, title, updated_at')
    .eq('organizacao_id', organizacaoId)
    .eq('user_id', usuarioId)
    .order('updated_at', { ascending: false })

  if (error) return []
  return data
}

export async function createNewSession(organizacaoId, usuarioId, title = 'Novo Planejamento') {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_planning_sessions')
    .insert({
      organizacao_id: organizacaoId,
      user_id: usuarioId,
      title: title,
      messages: [{ role: 'ai', content: 'Olá! Qual o planejamento para esta conversa?' }],
      current_plan: null
    })
    .select()
    .single()

  if (error) return { success: false, message: error.message }
  return { success: true, session: data }
}

export async function deleteSession(sessionId) {
  const supabase = await createClient()
  await supabase.from('ai_planning_sessions').delete().eq('id', sessionId)
  return { success: true }
}

export async function renameSession(sessionId, newTitle) {
  const supabase = await createClient()
  await supabase.from('ai_planning_sessions').update({ title: newTitle }).eq('id', sessionId)
  return { success: true }
}

export async function getSessionById(sessionId) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_planning_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  
  if (error) return { success: false }
  return { success: true, session: data }
}

export async function saveSessionState(sessionId, messages, currentPlan) {
  const supabase = await createClient()
  await supabase
    .from('ai_planning_sessions')
    .update({ messages, current_plan: currentPlan, updated_at: new Date() })
    .eq('id', sessionId)
}

// --- LÓGICA DA IA (MANTIDA IGUAL) ---

export async function generateActivityPlan(userMessage, organizacaoId, currentPlan = null) {
  if (!genAI) return { success: false, message: 'Erro: Chave API não configurada.' }
  const supabase = await createClient()

  try {
    const { data: contextData } = await supabase.rpc('get_ai_context_data', { p_organizacao_id: organizacaoId })
    const safeContext = contextData || { empreendimentos: [], funcionarios: [], etapas: [], tipos_atividade: [] }

    let systemPrompt = ''
    const baseRules = `
      REGRAS:
      1. STATUS: Sempre "Não Iniciado".
      2. RETORNO: Apenas JSON Array.
      3. HIERARQUIA: Use 'temp_id' e 'parent_temp_id'.
      4. CONTEXTO: Use IDs reais de OBRAS (${JSON.stringify(safeContext.empreendimentos)}) e EQUIPE (${JSON.stringify(safeContext.funcionarios)}).
    `

    if (currentPlan && Array.isArray(currentPlan) && currentPlan.length > 0) {
      systemPrompt = `ATUE COMO: Gerente Sênior. EDITE este JSON: ${JSON.stringify(currentPlan)}. PEDIDO: "${userMessage}". ${baseRules}`
    } else {
      systemPrompt = `ATUE COMO: Gerente Sênior. CRIE um plano JSON. DATA: ${new Date().toLocaleDateString('pt-BR')}. CONTEXTO EXTRA: Etapas ${JSON.stringify(safeContext.etapas)}. ${baseRules}. MODELO: [{ "temp_id": 1, "nome": "...", "status": "Não Iniciado", "parent_temp_id": null }]`
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { temperature: 1.0 } })
    const result = await model.generateContent(systemPrompt + `\n\nPEDIDO: "${userMessage}"`)
    let activities = cleanJsonOutput(result.response.text())
    
    if (!activities || activities.length === 0) return { success: false, message: 'Falha ao gerar plano.' }
    if (!Array.isArray(activities)) activities = [activities]
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
      const { data, error } = await supabase.from('activities').insert({ ...formatForDb(activity, organizacaoId, usuarioId), atividade_pai_id: null }).select('id').single()
      if (error) throw error
      if (activity.temp_id) idMap[activity.temp_id] = data.id
      totalSaved++
    }
    for (const activity of children) {
      const realParentId = idMap[activity.parent_temp_id]
      const { error } = await supabase.from('activities').insert({ ...formatForDb(activity, organizacaoId, usuarioId), atividade_pai_id: realParentId || null })
      if (error) throw error
      totalSaved++
    }
    return { success: true, count: totalSaved }
  } catch (error) {
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
    status: 'Não Iniciado',
    empreendimento_id: activity.empreendimento_id || null,
    funcionario_id: activity.funcionario_id || null,
    responsavel_texto: activity.responsavel_texto || null,
    organizacao_id: orgId,
    criado_por_usuario_id: userId
  }
}