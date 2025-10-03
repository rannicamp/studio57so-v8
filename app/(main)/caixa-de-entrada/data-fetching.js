// app/(main)/caixa-de-entrada/data-fetching.js

// Função para buscar a lista de conversas
export async function getConversations(supabase, organizacaoId) {
  if (!organizacaoId) return [];

  // Chama a função inteligente que criamos no Supabase (RPC)
  const { data, error } = await supabase.rpc('get_conversations_with_unread_count', {
    p_organizacao_id: organizacaoId
  });

  if (error) {
    console.error('Error fetching conversations:', error);
    throw new Error('Falha ao buscar conversas: ' + error.message);
  }
  return data || [];
}

// Função para buscar mensagens de uma conversa específica
export async function getMessages(supabase, organizacaoId, contactId) {
  if (!organizacaoId || !contactId) return [];

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*, contatos (*)')
    .eq('organizacao_id', organizacaoId)
    .eq('contato_id', contactId)
    .order('sent_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Falha ao buscar mensagens: ' + error.message);
  }
  return data || [];
}

// Função para marcar mensagens como lidas
export async function markMessagesAsRead(supabase, organizacaoId, contactId) {
    if (!organizacaoId || !contactId) return;

    const { error } = await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('organizacao_id', organizacaoId)
        .eq('contato_id', contactId)
        .eq('is_read', false);

    if (error) {
        console.error('Error marking messages as read:', error);
    }
}