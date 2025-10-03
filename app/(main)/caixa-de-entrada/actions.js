// app/(main)/caixa-de-entrada/actions.js
'use server'

import { createServerClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// Função para buscar a lista de conversas
export async function getConversations() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const { data, error } = await supabase.rpc('get_conversations_with_unread_count')

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }

  return data
}

// Função para buscar mensagens de uma conversa específica
export async function getMessages(contactId) {
  if (!contactId) return []
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select(`
      *,
      contatos (*)
    `)
    .eq('contato_id', contactId)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }
  return data
}

// Função para marcar mensagens como lidas
export async function markMessagesAsRead(contactId) {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    const { error } = await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('contato_id', contactId)
        .eq('is_read', false)

    if (error) {
        console.error('Error marking messages as read:', error)
    }
}