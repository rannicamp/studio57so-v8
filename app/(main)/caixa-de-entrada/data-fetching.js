// app/(main)/caixa-de-entrada/data-fetching.js

// Função para buscar a lista de conversas (Mantida, mas garantindo robustez)
export async function getConversations(supabase, organizacaoId) {
  if (!organizacaoId) return [];

  const { data, error } = await supabase.rpc('get_inbox_conversations', {
    p_organizacao_id: organizacaoId
  });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
  return data || [];
}

// Função para buscar mensagens (ATUALIZADA E MAIS INTELIGENTE)
export async function getMessages(supabase, organizacaoId, contactId, phoneNumber) {
  if (!organizacaoId) return [];
  if (!contactId && !phoneNumber) return [];

  let query = supabase
    .from('whatsapp_messages')
    .select('*, contatos (*)')
    .eq('organizacao_id', organizacaoId)
    .order('sent_at', { ascending: true });

  // A MÁGICA: Busca por ID do Contato OU pelo Número de Telefone
  // Isso garante que mensagens antigas (sem contato) e novas (com contato) apareçam juntas.
  if (contactId && phoneNumber) {
    // Limpa o telefone para evitar erros de formatação na query
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    query = query.or(`contato_id.eq.${contactId},sender_id.eq.${phoneNumber},receiver_id.eq.${phoneNumber},sender_id.eq.${cleanPhone},receiver_id.eq.${cleanPhone}`);
  } else if (contactId) {
    query = query.eq('contato_id', contactId);
  } else if (phoneNumber) {
    query = query.or(`sender_id.eq.${phoneNumber},receiver_id.eq.${phoneNumber}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching messages:', error);
    // Não lança erro para não quebrar a UI, retorna vazio
    return [];
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