import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export function useChatContacts() {
    const { organizacao_id } = useAuth();
    const supabase = createClient();

    return useQuery({
        queryKey: ['chat_contacts', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];

            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome, sobrenome, email, avatar_url, funcoes(nome_funcao)')
                .eq('organizacao_id', organizacao_id)
                .order('nome');

            if (error) {
                console.error("Erro ao buscar contatos do chat", error);
                throw error;
            }

            const contatosFiltrados = data.filter(u => {
                const cargo = u.funcoes?.nome_funcao?.toLowerCase() || '';
                return !cargo.includes('corretor');
            });

            return contatosFiltrados;
        },
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5,
    });
}

// 1. Hook para buscar a Conversa (ID)
export function useConversation(contactId) {
    const { user, organizacao_id } = useAuth();
    const supabase = createClient();

    return useQuery({
        queryKey: ['chat_conversation', user?.id, contactId],
        queryFn: async () => {
            // Em caso de Broadcast, ainda será tratado no futuro
            if (!user?.id || !contactId || !organizacao_id || contactId.isBroadcast) return null;

            const { data, error } = await supabase
                .rpc('get_or_create_conversation', {
                    p_user_id: user.id,
                    p_contact_id: contactId,
                    p_org_id: organizacao_id
                });

            if (error) {
                console.error("Erro ao iniciar/buscar conversa:", error);
                throw error;
            }

            return data; // retorna o uuid da conversation
        },
        enabled: !!user?.id && !!contactId && !!organizacao_id && !contactId?.isBroadcast,
        staleTime: 1000 * 60 * 60, // 1 hora
    });
}

// 2. Hook para as Mensagens + Realtime
export function useChatMessages(conversationId) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['chat_messages', conversationId],
        queryFn: async () => {
            if (!conversationId) return [];

            const { data, error } = await supabase
                .from('sys_chat_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!conversationId,
        staleTime: Infinity, // Realtime vai cuidar da atualização
    });

    // Supabase Realtime Subscription + Update Visto
    useEffect(() => {
        if (!conversationId) return;

        const channel = supabase.channel(`mensagens-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sys_chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    queryClient.setQueryData(['chat_messages', conversationId], (oldData) => {
                        if (!oldData) return [payload.new];
                        // Evita duplicatas caso a propria mutação recarregue mais rapido q o supabase
                        if (oldData.find(msg => msg.id === payload.new.id)) return oldData;
                        return [...oldData, payload.new];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sys_chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    queryClient.setQueryData(['chat_messages', conversationId], (oldData) => {
                        if (!oldData) return;
                        return oldData.map(msg => msg.id === payload.new.id ? payload.new : msg);
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, queryClient, supabase]);

    return query;
}

// 3. Hook Mutation para Enviar msg 
export function useSendMessage() {
    const supabase = createClient();

    return useMutation({
        mutationFn: async ({ conversationId, senderId, conteudo }) => {
            const { data, error } = await supabase
                .from('sys_chat_messages')
                .insert([
                    {
                        conversation_id: conversationId,
                        sender_id: senderId,
                        conteudo: conteudo
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    });
}

// 4. Hook Mutation para Marcar como Lido (Visto Azul Whatsapp)
export function useMarkAsRead() {
    const supabase = createClient();

    return useMutation({
        mutationFn: async ({ conversationId, userId }) => {
            if (!conversationId || !userId) return;
            const { error } = await supabase.rpc('mark_messages_as_read', {
                p_conversation_id: conversationId,
                p_user_id: userId
            });
            if (error) throw error;
        }
    });
}

// 5. Hook para listar as conversas ativas do usuario
export function useConversationsList() {
    const { user, organizacao_id } = useAuth();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['chat_conversations_list', user?.id],
        queryFn: async () => {
            if (!user?.id || !organizacao_id) return [];
            const { data, error } = await supabase.rpc('get_user_conversations', {
                p_user_id: user.id,
                p_org_id: organizacao_id
            });
            if (error) {
                console.error("Erro listando conversas", error);
                throw error;
            }
            return data || [];
        },
        enabled: !!user?.id && !!organizacao_id,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel(`mensagens-list-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sys_chat_messages' }, () => {
                queryClient.invalidateQueries({ queryKey: ['chat_conversations_list', user.id] });
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [user?.id, queryClient, supabase]);

    return query;
}

// 6. Hook Mutation para Enviar Memorando (Broadcast em Lote)
export function useSendBroadcast() {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    
    return useMutation({
        mutationFn: async ({ userIds, conteudo }) => {
            if (!userIds || userIds.length === 0 || !conteudo || !user || !organizacao_id) return;
            
            // Loop para criar conversa e enviar msg pra cada selecionado
            const promises = userIds.map(async (targetId) => {
                const { data: convId, error: convErr } = await supabase.rpc('get_or_create_conversation', {
                    p_user_id: user.id,
                    p_contact_id: targetId,
                    p_org_id: organizacao_id
                });
                if (convErr || !convId) throw convErr;
                
                return supabase.from('sys_chat_messages').insert([{
                    conversation_id: convId,
                    sender_id: user.id,
                    conteudo: conteudo
                }]);
            });

            await Promise.all(promises);
        }
    });
}
