// app/(main)/caixa-de-entrada/data-fetching.js

import { createClient } from '@/utils/supabase/client';

export const getConversations = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    try {
        // --- QUERY HÍBRIDA ---
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
                ),
                recent_msgs: whatsapp_messages!whatsapp_messages_conversation_record_id_fkey (
                    sent_at,
                    direction
                )
            `)
            .eq('organizacao_id', organizacaoId)
            // Ordenamos as mensagens recentes para garantir que achamos a última recebida do cliente
            .order('sent_at', { foreignTable: 'recent_msgs', ascending: false })
            .limit(10, { foreignTable: 'recent_msgs' })
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar conversas:', error);
            return [];
        }

        return data.map(conv => {
            // --- 1. LÓGICA DO FUNIL ---
            let nomeEtapa = null;
            const dadosFunil = conv.contatos?.funil;

            if (Array.isArray(dadosFunil) && dadosFunil.length > 0) {
                nomeEtapa = dadosFunil[0]?.coluna?.nome;
            } else if (dadosFunil && typeof dadosFunil === 'object') {
                nomeEtapa = dadosFunil?.coluna?.nome;
            }

            // --- 2. LÓGICA DO CRONÔMETRO ---
            const lastInboundMsg = conv.recent_msgs?.find(m => m.direction === 'inbound');
            const lastInboundAt = lastInboundMsg ? lastInboundMsg.sent_at : null;

            return {
                conversation_id: conv.id,
                contato_id: conv.contatos?.id,
                phone_number: conv.phone_number,
                nome: conv.contatos?.nome || conv.phone_number,
                avatar_url: conv.contatos?.foto_url,
                unread_count: conv.unread_count || 0,
                last_message_content: conv.last_message?.content,
                // ADICIONADO: Status da última mensagem para saber se falhou
                last_message_status: conv.last_message?.status,
                last_message_at: conv.last_message?.created_at || conv.updated_at,
                is_archived: conv.is_archived || false,
                
                // Dados Restaurados
                tipo_contato: conv.contatos?.tipo_contato,
                etapa_funil: nomeEtapa,
                
                // Dado Novo
                last_inbound_at: lastInboundAt
            };
        });

    } catch (err) {
        console.error("Erro fatal (try/catch) em getConversations:", err);
        return [];
    }
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
        
    await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('organizacao_id', organizacaoId)
        .eq('contato_id', contatoId)
        .eq('is_read', false);
};