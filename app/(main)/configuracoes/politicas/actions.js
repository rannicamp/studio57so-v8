// app/(main)/configuracoes/politicas/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Busca as versões atuais das políticas aplicadas a todos os usuários
 */
export async function getActivePlatformPolicies() {
 try {
  const supabase = await createClient()

  const { data, error } = await supabase
  .from('politicas_plataforma')
  .select('*')
  .eq('is_active', true)
  .order('tipo', { ascending: true })

  if (error) {
  console.error('Erro ao buscar políticas ativas:', error)
  return []
  }

  return data
 } catch (err) {
  console.error('Edge crash prevent', err)
  return []
 }
}

/**
 * Busca o histórico de aceites do usuário autenticado (Auditoria)
 */
export async function getMyAcceptanceHistory() {
 try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
  .from('usuario_aceite_politicas')
  .select('*, politicas_plataforma(titulo, versao)')
  .eq('usuario_id', user.id)
  .order('data_aceite', { ascending: false })

  if (error) {
  console.error('Erro ao buscar histórico de aceites:', error)
  return []
  }

  return data
 } catch (err){
  console.error('Edge crash', err)
  return []
 }
}