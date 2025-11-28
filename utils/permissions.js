//utils/permissions.js
import { createClient } from './supabase/server';
import { unstable_noStore as noStore } from 'next/cache';

/**
 * Verifica se o usuário logado tem permissão para um recurso específico.
 */
export async function checkPermission(permissionKey) {
  noStore();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  // 1. Busca dados do usuário e sua função
  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao_id')
    .eq('id', user.id)
    .single();

  if (!userData?.funcao_id) return false;

  const { funcao_id } = userData;

  // 2. Se for Proprietário, libera tudo (Super Admin)
  const { data: funcaoData } = await supabase
    .from('funcoes')
    .select('nome_funcao')
    .eq('id', funcao_id)
    .single();

  if (funcaoData?.nome_funcao === 'Proprietário') return true;

  // 3. Verifica a permissão específica na tabela
  const { data: permissionData, error } = await supabase
    .from('permissoes')
    .select('pode_ver')
    .eq('funcao_id', funcao_id)
    .eq('recurso', permissionKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao verificar permissão:', error);
    return false;
  }

  return permissionData ? permissionData.pode_ver : false;
}

/**
 * 🔍 BUSCA IDS DE USUÁRIOS POR PERMISSÃO (FAN-OUT)
 * Retorna uma lista de IDs de usuários que possuem acesso a um determinado recurso.
 * Útil para enviar notificações em massa (ex: "Avisar todos que podem ver Financeiro").
 */
export async function buscarIdsPorPermissao(permissionKey, organizacaoId = null) {
  const supabase = createClient();

  // 1. Acha quais FUNÇÕES têm permissão para ver esse recurso
  const { data: funcoesPermitidas } = await supabase
    .from('permissoes')
    .select('funcao_id')
    .eq('recurso', permissionKey)
    .eq('pode_ver', true);

  if (!funcoesPermitidas?.length) return [];

  const listaFuncoesIds = funcoesPermitidas.map(f => f.funcao_id);

  // 2. Busca o ID da função 'Proprietário' (eles sempre recebem tudo)
  const { data: funcProprietario } = await supabase
    .from('funcoes')
    .select('id')
    .eq('nome_funcao', 'Proprietário')
    .single();
    
  if (funcProprietario) {
    listaFuncoesIds.push(funcProprietario.id);
  }

  // 3. Busca todos os USUÁRIOS que têm essas funções
  let query = supabase
    .from('usuarios')
    .select('id')
    .in('funcao_id', listaFuncoesIds);

  if (organizacaoId) {
    query = query.eq('organizacao_id', organizacaoId);
  }

  const { data: usuarios } = await query;

  if (!usuarios) return [];
  
  // Retorna array limpo apenas com os IDs: ['uuid-1', 'uuid-2']
  return usuarios.map(u => u.id);
}