import { createClient } from '@/utils/supabase/client';

export const getConversations = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    try {
        // --- CÓDIGO ORIGINAL (PRESERVADO) ---
        // Usamos exatamente a estrutura que você confirmou que funciona bem
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
            // Fallback silencioso para não quebrar a tela inteira em caso de erro
            return [];
        }

        // --- MAP (ONDE A MÁGICA ACONTECE) ---
        return data.map(conv => {
            // Lógica de Segurança para extrair a etapa
            // Verifica se 'funil' é uma lista (array) ou objeto e pega o nome da coluna
            let nomeEtapa = null;
            const dadosFunil = conv.contatos?.funil;

            if (Array.isArray(dadosFunil) && dadosFunil.length > 0) {
                nomeEtapa = dadosFunil[0]?.coluna?.nome;
            } else if (dadosFunil && typeof dadosFunil === 'object') {
                nomeEtapa = dadosFunil?.coluna?.nome;
            }

            return {
                conversation_id: conv.id,
                contato_id: conv.contatos?.id,
                phone_number: conv.phone_number,
                // Prioriza o nome do contato, senão usa o número
                nome: conv.contatos?.nome || conv.phone_number,
                avatar_url: conv.contatos?.foto_url,
                unread_count: conv.unread_count || 0,
                
                // Dados da última mensagem
                last_message_content: conv.last_message?.content,
                last_message_at: conv.last_message?.created_at || conv.updated_at,
                
                is_archived: conv.is_archived || false,
                
                // Dados extras para a lista
                tipo_contato: conv.contatos?.tipo_contato,
                etapa_funil: nomeEtapa // <--- AQUI ESTÁ A ETAPA QUE VOCÊ QUERIA
            };
        });

    } catch (err) {
        console.error("Erro fatal (try/catch) em getConversations:", err);
        return [];
    }
};

// --- FUNÇÃO: BUSCAR LISTAS DE TRANSMISSÃO ---
// Mantida conforme seu original
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

// Funções auxiliares mantidas
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
        
    await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('organizacao_id', organizacaoId)
        .eq('contato_id', contatoId)
        .eq('is_read', false);
};