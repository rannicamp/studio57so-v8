'use client'

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Importamos a nova função getBroadcastLists
import { getConversations, getBroadcastLists, markMessagesAsRead } from './data-fetching';
import ConversationList from '@/components/whatsapp/ConversationList';
import MessagePanel from '@/components/whatsapp/MessagePanel';
import ContactProfile from '@/components/whatsapp/ContactProfile';
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

export default function CaixaDeEntrada() {
    const [selectedContact, setSelectedContact] = useState(null);
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Busca Conversas (Chat)
    const { data: conversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    // 2. Busca Listas de Transmissão (Novo)
    const { data: broadcastLists, isLoading: isLoadingLists } = useQuery({
        queryKey: ['broadcastLists', organizacaoId],
        queryFn: () => getBroadcastLists(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    // Realtime Updates (Ouvir mudanças)
    useEffect(() => {
        if (!organizacaoId) return;

        // Canal para Contatos e Conversas
        const channel = supabase.channel('contacts-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos', filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
                queryClient.invalidateQueries(['conversations', organizacaoId]);
                if (selectedContact?.contato_id === payload.new?.id) {
                    setSelectedContact(prev => ({ ...prev, nome: payload.new.nome, avatar_url: payload.new.foto_url }));
                }
            })
            // Novo: Ouvir mudanças nas listas também
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_broadcast_lists', filter: `organizacao_id=eq.${organizacaoId}` }, () => {
                queryClient.invalidateQueries(['broadcastLists', organizacaoId]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organizacaoId, queryClient, selectedContact?.contato_id]);


    const handleSelectContact = async (contact) => {
        setSelectedContact(contact);
        if (contact.unread_count > 0) {
            await markMessagesAsRead(supabase, organizacaoId, contact.contato_id);
            queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
        }
    };

    const handleBackToList = () => {
        setSelectedContact(null);
    };
    
    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden">
            <Toaster position="top-right" richColors />

            {/* COLUNA 1: LISTA (Conversas ou Listas) */}
            <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white`}>
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-[#f0f2f5] shrink-0">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full pl-10 pr-4 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884] text-sm"
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>
                
                <ConversationList
                    conversations={conversations}
                    broadcastLists={broadcastLists} // Passamos as listas novas
                    isLoading={isLoadingConversations || isLoadingLists}
                    onSelectContact={handleSelectContact}
                    selectedContactId={selectedContact?.contato_id}
                />
            </div>

            {/* COLUNA 2: PAINEL DE MENSAGENS */}
            <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-[#efeae2]`}>
                <MessagePanel 
                    contact={selectedContact}
                    onBack={handleBackToList}
                />
            </div>
            
            {/* COLUNA 3: PERFIL */}
            <div className="hidden lg:flex w-1/4 flex-col border-l bg-white">
                <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0">
                    <h2 className="text-base font-semibold text-gray-700">Dados do Contato</h2>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {selectedContact && (
                       <ContactProfile contact={selectedContact} />
                    )}
                </div>
            </div>
        </div>
    );
}