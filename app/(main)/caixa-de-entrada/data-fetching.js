// app/(main)/caixa-de-entrada/data-fetching.js

// Função para buscar a lista de conversas
export async function getConversations(supabase, organizacaoId) {
  if (!organizacaoId) return [];

  // ATENÇÃO: Agora chamamos a nova função que agrupa por Contato ID
  const { data, error } = await supabase.rpc('get_inbox_conversations', {
    p_organizacao_id: organizacaoId
  });

  if (error) {
    console.error('Error fetching conversations:', error);
    // Fallback silencioso ou erro customizado
    return []; 
  }
  return data || [];
}

// Função para buscar mensagens de uma conversa específica
export async function getMessages(supabase, organizacaoId, contactId) {
  if (!organizacaoId || !contactId) return [];

  // A busca de mensagens agora é muito mais segura: Pelo ID do Contato
  // Isso traz mensagens de TODOS os números que esse contato tiver.
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