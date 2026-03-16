// app/(main)/atividades/actions-ai.js
'use server'

import { createClient } from '@/utils/supabase/server'

/* ============================================================================
   1. FUNÇÕES AUXILIARES E CONTEXTO
   ============================================================================ */

async function getContextForAI(organizacaoId, userId) {
  const supabase = await createClient();

  // 1. Busca os dados padrao (obras, funcionarios) usando RPC
  let baseContext = { empreendimentos: [], funcionarios: [] };
  const { data: rpcData, error } = await supabase.rpc('get_ai_context_data', {
    p_organizacao_id: organizacaoId
  });
  if (!error && rpcData) baseContext = rpcData;

  // 2. Tenta buscar o nome do usuario na tabela funcionarios para personalização
  let nomeUsuario = "Amigo(a)";
  let funcionarioId = null;
  const { data: funcData } = await supabase
    .from('funcionarios')
    .select('id, nome')
    .eq('usuario_id', userId)
    .eq('organizacao_id', organizacaoId)
    .limit(1)
    .maybeSingle();

  if (funcData) {
    nomeUsuario = funcData.nome.split(' ')[0]; // Pega primeiro nome
    funcionarioId = funcData.id;
  } else {
    // Se não for funcionario, busca na tabela de usuarios
    const { data: userData } = await supabase.from('usuarios').select('nome').eq('id', userId).maybeSingle();
    if (userData && userData.nome) nomeUsuario = userData.nome.split(' ')[0];
  }

  // 3. Buscar a Agenda do Usuário (Próximos 30 dias) - SEGURANÇA MÁXIMA
  let agendaContext = [];
  try {
    let query = supabase
      .from('activities')
      .select('nome, tipo_atividade, data_inicio_prevista, hora_inicio, duracao_dias, duracao_horas, status')
      .eq('organizacao_id', organizacaoId)
      .neq('status', 'Concluído')
      .gte('data_inicio_prevista', new Date().toISOString().split('T')[0])
      .order('data_inicio_prevista', { ascending: true })
      .limit(20);

    // Filtra pelo responsavel (se ele for funcionario, usa o funcionario_id, senão busca atv. criadas por ele)
    if (funcionarioId) {
      query = query.eq('funcionario_id', funcionarioId);
    } else {
      query = query.eq('criado_por_usuario_id', userId);
    }

    const { data: agendaData } = await query;
    if (agendaData) agendaContext = agendaData;
  } catch (err) {
    console.log("Aviso: Falha ao buscar agenda:", err);
  }

  return {
    ...baseContext,
    nome_usuario: nomeUsuario,
    agenda_atual: agendaContext
  };
}

/* ============================================================================
   2. GERAÇÃO E EXECUÇÃO DO PLANO
   ============================================================================ */

export async function generateActivityPlan(messagesHistory, organizacaoId, usuarioId, currentPlan = null) {
  try {
    const contextData = await getContextForAI(organizacaoId, usuarioId);
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${appUrl}/api/ai/agent-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messagesHistory,
        contextData,
        today,
        currentPlan
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const rawText = await response.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseError) {
      console.error("FALHA AO FAZER PARSE DO JSON DO GEMINI. RAW TEXT:");
      try {
        require('fs').writeFileSync('failed_gemini.json', rawText);
      } catch (e) { }
      throw new Error(`Parse failed: ${parseError.message}. Check failed_gemini.json`);
    }

    // Agora o server sempre retorna { success: true } num HTTP 200, 
    // mas os campos dependem se é conversational ou estruturado.
    if (result.activities && result.activities.length > 0) {
      return { success: true, type: 'plan', data: result.activities, thought: result.thought_process, message: result.message };
    } else {
      return { success: true, type: 'message', message: result.message || result.question_to_user || "Entendido." };
    }

  } catch (error) {
    console.error("Erro no generateActivityPlan:", error);
    return { type: 'message', message: `Oops: ${error.message}` };
  }
}

export async function confirmActivityPlan(activitiesList, organizacaoId, userId, currentPlan = []) {
  const supabase = await createClient();

  // 0. A IA remove as tarefas do array quando apaga. 
  // Precisamos descobrir quais IDs sumiram comparando o currentPlan com o novo activitiesList
  const newIds = activitiesList.map(a => a.id).filter(id => id); // IDs que a IA manteve
  const deletedTasks = currentPlan.filter(oldTask => oldTask.id && !newIds.includes(oldTask.id));

  // Executar DELETES primeiro
  for (const deletedTask of deletedTasks) {
    const { error } = await supabase.from('activities').delete().eq('id', deletedTask.id).eq('criado_por_usuario_id', userId);
    if (error) console.error("Erro ao deletar atividade órfã:", error);
  }

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
  const finalSyncedPlan = [];

  // Ordena para salvar/atualizar Pais antes dos Filhos
  const parents = activitiesList.filter(a => !a.parent_temp_id);
  const children = activitiesList.filter(a => a.parent_temp_id);
  const orderedList = [...parents, ...children];

  for (const activity of orderedList) {
    const action = activity.action || 'CREATE';

    // A Action de Delete também lidamos aqui caso a IA devolva explicitamente
    if (action === 'DELETE') {
      if (activity.id) {
        await supabase.from('activities').delete().eq('id', activity.id).eq('criado_por_usuario_id', userId);
      }
      continue;
    }

    // 1. Resolve Responsável
    let finalFuncionarioId = activity.funcionario_id;
    let finalRespTexto = activity.responsavel_texto;

    if (finalFuncionarioId && finalFuncionarioId !== 'SELF') {
      const parsedId = parseInt(finalFuncionarioId);
      if (isNaN(parsedId)) {
        // A IA desobedeceu e enviou um nome literal em vez do ID. Tentamos resgatar no banco:
        const searchTerm = finalFuncionarioId.trim();
        const { data: fallbackUser } = await supabase
          .from('funcionarios')
          .select('id, nome')
          .eq('organizacao_id', organizacaoId)
          .ilike('nome', `%${searchTerm}%`)
          .limit(1)
          .maybeSingle();

        if (fallbackUser) {
          finalFuncionarioId = fallbackUser.id;
          if (!finalRespTexto) finalRespTexto = fallbackUser.nome;
        } else {
          finalFuncionarioId = null; 
        }
      } else {
        finalFuncionarioId = parsedId;
      }
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
      status: activity.status || 'Não Iniciado', // Sempre com I maiúsculo para o Kanban

      tipo_atividade: activity.tipo_atividade || 'Tarefa',
      data_inicio_prevista: activity.data_inicio_prevista,
      data_fim_prevista: activity.data_inicio_prevista, // Simplified

      duracao_dias: isEvent ? 0 : (activity.duracao_dias || 1),
      hora_inicio: isEvent ? activity.hora_inicio : null,
      duracao_horas: isEvent ? (activity.duracao_horas || 1) : null,

      empreendimento_id: activity.empreendimento_id || null,
      funcionario_id: finalFuncionarioId || null,
      responsavel_texto: finalRespTexto,
      atividade_pai_id: parentId
    };

    if (action === 'UPDATE' && activity.id) {
      const { data, error } = await supabase.from('activities').update(dbPayload).eq('id', activity.id).eq('criado_por_usuario_id', userId).select().single();
      if (error) {
        console.error("Erro ao atualizar atividade:", error);
      } else {
        finalSyncedPlan.push(data);
        savedCount++;
      }
    }
    else if (action === 'KEEP') {
      if (activity.id) {
        // Se já tem ID, já está no banco, não precisa inserir nem atualizar
        finalSyncedPlan.push(activity);
      } else {
        // KEEP sem ID? Fallback para CREATE
        const { data, error } = await supabase.from('activities').insert(dbPayload).select().single();
        if (!error && data) {
          if (activity.temp_id) tempIdMap[activity.temp_id] = data.id;
          finalSyncedPlan.push(data);
          savedCount++;
        }
      }
    }
    else if (action === 'CREATE' || !activity.id) {
      const { data, error } = await supabase.from('activities').insert(dbPayload).select().single();
      if (error) {
        console.error("Erro ao salvar atividade:", error);
      } else {
        if (activity.temp_id) {
          tempIdMap[activity.temp_id] = data.id;
        }
        finalSyncedPlan.push(data);
        savedCount++;
      }
    }
  }

  // IMPORTANTE: Padroniza o retorno formatado com icones/detalhes igual a geração inicial pro Copilot
  // Para que o frontend possa desenhar corretamente sem bugar
  const mappedFinalPlan = finalSyncedPlan.map(item => ({
    ...item,
    // O AI Schema usa campos formatados, devolvemos pra que o state não quebre
    id: item.id,
    temp_id: item.id,
    action: 'KEEP'
  }));

  return { success: true, count: savedCount, finalPlan: mappedFinalPlan };
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