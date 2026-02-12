// app/(main)/atividades/actions-ai.js
'use server'

import { createClient } from '@/utils/supabase/server'

/* ============================================================================
   1. FUNÇÕES AUXILIARES E CONTEXTO
   ============================================================================ */

async function getContextForAI(organizacaoId) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_ai_context_data', { 
    p_organizacao_id: organizacaoId 
  });

  if (error) {
    console.error("Erro ao buscar contexto:", error);
    return { empreendimentos: [], funcionarios: [] };
  }
  return data;
}

/* ============================================================================
   2. GERAÇÃO E EXECUÇÃO DO PLANO
   ============================================================================ */

export async function generateActivityPlan(userMessage, organizacaoId, currentPlan = null) {
  try {
    const contextData = await getContextForAI(organizacaoId);
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const messagesPayload = [{ role: 'user', content: userMessage }];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${appUrl}/api/ai/agent-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: messagesPayload, 
        contextData, 
        today,
        currentPlan 
      })
    });

    if (!response.ok) throw new Error('Falha ao falar com o Agente');

    const result = await response.json();
    
    if (result.activities && result.activities.length > 0) {
        return { type: 'plan', data: result.activities, thought: result.thought_process };
    } else if (result.clarification_needed) {
        return { type: 'message', message: result.question_to_user || "Preciso saber o horário." };
    } else {
        return { type: 'message', message: "Entendido, mas não gerei tarefas novas." };
    }

  } catch (error) {
    console.error("Erro no generateActivityPlan:", error);
    return { type: 'message', message: "Desculpe, tive um problema técnico." };
  }
}

export async function confirmActivityPlan(activitiesList, organizacaoId, userId) {
  const supabase = await createClient();
  
  // Busca ID do funcionário do usuário atual para o "SELF"
  let myEmployeeId = null;
  const { data: funcionarioData } = await supabase
    .from('funcionarios')
    .select('id')
    .eq('organizacao_id', organizacaoId)
    .limit(1)
    .maybeSingle();
  
  if (funcionarioData) myEmployeeId = funcionarioData.id;

  let savedCount = 0;
  const tempIdMap = {}; 

  // Ordena para salvar Pais antes dos Filhos
  const parents = activitiesList.filter(a => !a.parent_temp_id);
  const children = activitiesList.filter(a => a.parent_temp_id);
  const orderedList = [...parents, ...children];

  for (const activity of orderedList) {
    
    // 1. Resolve Responsável
    let finalFuncionarioId = activity.funcionario_id;
    let finalRespTexto = activity.responsavel_texto;

    if (finalFuncionarioId && finalFuncionarioId !== 'SELF') {
        finalFuncionarioId = parseInt(finalFuncionarioId);
    }

    if (finalFuncionarioId === 'SELF') {
      if (myEmployeeId) {
        finalFuncionarioId = myEmployeeId;
        finalRespTexto = null;
      } else {
        finalFuncionarioId = null;
        finalRespTexto = "Eu (Usuário Atual)";
      }
    }

    // 2. Resolve Pai
    let parentId = activity.atividade_pai_id || null;
    if (activity.parent_temp_id && tempIdMap[activity.parent_temp_id]) {
        parentId = tempIdMap[activity.parent_temp_id];
    }

    // 3. SEPARAÇÃO RIGOROSA: TAREFA vs EVENTO 🛡️
    const isEvent = activity.tipo_atividade === 'Evento';
    
    const dbPayload = {
      organizacao_id: organizacaoId,
      criado_por_usuario_id: userId,
      
      nome: activity.nome,
      descricao: activity.descricao,
      status: 'Não Iniciado', // Sempre com I maiúsculo para o Kanban
      
      // Tipo (Garante Evento ou Tarefa)
      tipo_atividade: activity.tipo_atividade || 'Tarefa',
      
      // Datas
      data_inicio_prevista: activity.data_inicio_prevista,
      data_fim_prevista: activity.data_inicio_prevista,
      
      // A REGRA DE OURO:
      // Se é Evento -> Dias = 0, Hora = O que a IA mandou (ou null se falhar), Duração Horas = IA ou 1
      // Se é Tarefa -> Dias = IA ou 1, Hora = NULL, Duração Horas = NULL
      duracao_dias: isEvent ? 0 : (activity.duracao_dias || 1),
      hora_inicio: isEvent ? activity.hora_inicio : null,
      duracao_horas: isEvent ? (activity.duracao_horas || 1) : null,
      
      // Vínculos
      empreendimento_id: activity.empreendimento_id || null, 
      funcionario_id: finalFuncionarioId || null,
      responsavel_texto: finalRespTexto,
      atividade_pai_id: parentId
    };

    const { data, error } = await supabase.from('activities').insert(dbPayload).select('id').single();
    
    if (error) {
      console.error("Erro ao salvar atividade:", error);
    } else {
      if (activity.temp_id) {
          tempIdMap[activity.temp_id] = data.id;
      }
      savedCount++;
    }
  }

  return { success: true, count: savedCount };
}

/* ============================================================================
   3. GERENCIAMENTO DE SESSÕES
   ============================================================================ */

export async function listUserSessions(organizacaoId, usuarioId) {
  if (!organizacaoId || !usuarioId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('ai_planning_sessions').select('id, title, updated_at').eq('organizacao_id', organizacaoId).eq('user_id', usuarioId).order('updated_at', { ascending: false });
  return data || [];
}

export async function createNewSession(organizacaoId, usuarioId, title) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('ai_planning_sessions').insert({ organizacao_id: organizacaoId, user_id: usuarioId, title: title, messages: [], current_plan: [] }).select().single();
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
  await supabase.from('ai_planning_sessions').update({ messages: messages, current_plan: currentPlan, updated_at: new Date().toISOString() }).eq('id', sessionId);
}

export async function deleteSession(sessionId) {
  const supabase = await createClient();
  await supabase.from('ai_planning_sessions').delete().eq('id', sessionId);
}

export async function renameSession(sessionId, newTitle) {
  const supabase = await createClient();
  await supabase.from('ai_planning_sessions').update({ title: newTitle }).eq('id', sessionId);
}