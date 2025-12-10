import { createClient } from '@/utils/supabase/client';

export const getConversations = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
            *,
            contatos (
                id,
                nome,
                foto_url,
                tipo_contato,
                telefone_principal: telefones (telefone),
                funil: contatos_no_funil!contato_id (
                    coluna: colunas_funil (
                        nome
                    )
                )
            ),
            last_message: whatsapp_messages!last_message_id (
                content,
                created_at,
                status
            )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar conversas:', error);
        return [];
    }

    return data.map(conv => ({
        conversation_id: conv.id,
        contato_id: conv.contatos?.id,
        phone_number: conv.phone_number,
        nome: conv.contatos?.nome || conv.phone_number,
        avatar_url: conv.contatos?.foto_url,
        unread_count: conv.unread_count || 0,
        last_message_content: conv.last_message?.content,
        last_message_at: conv.last_message?.created_at || conv.updated_at,
        is_archived: conv.is_archived || false,
        // --- DADOS PARA A LISTA ---
        tipo_contato: conv.contatos?.tipo_contato,
        // Como 'funil' retorna um array, pegamos o primeiro item (se existir)
        etapa_funil: conv.contatos?.funil?.[0]?.coluna?.nome || null
    }));
};

// --- FUNÇÃO: BUSCAR LISTAS DE TRANSMISSÃO ---
export const getBroadcastLists = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('whatsapp_broadcast_lists')
        .select(`
            *,
            membros:whatsapp_list_members(count)
        `)
        .eq('organizacao_id', organizacaoId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar listas:', error);
        return [];
    }

    return data.map(lista => ({
        ...lista,
        membros_count: lista.membros?.[0]?.count || 0
    }));
};

export const getMessages = async (supabase, organizacaoId, contatoId) => {
    if (!organizacaoId || !contatoId) return [];

    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .eq('contato_id', contatoId)
        .order('sent_at', { ascending: true });

    if (error) {
        console.error('Erro ao buscar mensagens:', error);
        return [];
    }

    return data;
};

export const markMessagesAsRead = async (supabase, organizacaoId, contatoId) => {
    if (!organizacaoId || !contatoId) return;

    await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('organizacao_id', organizacaoId)
        .eq('contato_id', contatoId);
};