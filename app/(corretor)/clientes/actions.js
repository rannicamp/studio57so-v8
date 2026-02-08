// app/(corretor)/clientes/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Buscar Clientes (Filtrando Lixeira)
export async function getMeusClientes() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('contatos')
    .select('*')
    .eq('criado_por_usuario_id', user.id) // Apenas clientes desse corretor
    .eq('tipo_contato', 'Cliente') // Garante que é cliente final
    .eq('lixeira', false) // <--- O FILTRO: Esconde os deletados
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar clientes:', error)
    return []
  }

  return data
}

// 2. Soft Delete (Enviar para Lixeira)
export async function softDeleteCliente(clienteId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Não autorizado' }

  // Atualiza lixeira = true (Não usa DELETE!)
  const { error } = await supabase
    .from('contatos')
    .update({ lixeira: true })
    .eq('id', clienteId)
    .eq('criado_por_usuario_id', user.id) // Segurança: só apaga o que ele criou

  if (error) {
      console.error('Erro ao excluir cliente:', error)
      return { error: error.message }
  }

  revalidatePath('/(corretor)/clientes')
  return { success: true }
}