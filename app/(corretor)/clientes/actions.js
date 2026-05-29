// app/(corretor)/clientes/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Buscar Clientes (Filtrando Lixeira)
export async function getMeusClientes() {
 try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
  .from('usuarios')
  .select('funcao_id, is_superadmin, organizacao_id')
  .eq('id', user.id)
  .single()

  if (!profile) return []

  const isProprietario = profile.funcao_id === 1 || profile.is_superadmin === true;

  let query = supabase
  .from('contatos')
  .select('*')
  .eq('organizacao_id', profile.organizacao_id) // Filtro de tenant
  .eq('tipo_contato', 'Cliente') // Garante que é cliente final
  .eq('lixeira', false) // <--- O FILTRO: Esconde os deletados

  if (!isProprietario) {
    query = query.eq('criado_por_usuario_id', user.id) // Segurança: corretores veem apenas o que criaram
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
  console.error('Erro ao buscar clientes:', error)
  return []
  }

  return data
 } catch (err) {
  console.error('Edge crash prevent', err)
  return []
 }
}

// 2. Soft Delete (Enviar para Lixeira)
export async function softDeleteCliente(clienteId) {
 try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
  .from('usuarios')
  .select('funcao_id, is_superadmin')
  .eq('id', user.id)
  .single()

  if (!profile) return { error: 'Não autorizado' }

  const isProprietario = profile.funcao_id === 1 || profile.is_superadmin === true;

  let query = supabase
  .from('contatos')
  .update({ lixeira: true })
  .eq('id', clienteId)

  if (!isProprietario) {
    query = query.eq('criado_por_usuario_id', user.id) // Segurança: corretores só apagam o que criaram
  }

  const { error } = await query

  if (error) {
  console.error('Erro ao excluir cliente:', error)
  return { error: error.message }
  }

  revalidatePath('/(corretor)/clientes')
  return { success: true }
 } catch (err) {
  console.error('Edge crash prevent', err)
  return { error: 'Erro de conectividade.' }
 }
}