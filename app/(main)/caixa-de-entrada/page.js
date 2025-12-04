'use client'

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getConversations, markMessagesAsRead } from './data-fetching';
import ConversationList from '@/components/whatsapp/ConversationList';
import MessagePanel from '@/components/whatsapp/MessagePanel';
import ContactProfile from '@/components/whatsapp/ContactProfile';
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function CaixaDeEntrada() {
    const [selectedContact, setSelectedContact] = useState(null);
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Busca as conversas (Já traz o nome atualizado via SQL)
    const { data: conversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true, // Garante atualização ao voltar pra aba
    });

    // 2. NOVO: Listener para atualizar Nomes/Fotos em Tempo Real
    useEffect(() => {
        if (!organizacaoId) return;

        const channel = supabase
            .channel('contacts-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Escuta Criar, Editar ou Deletar
                    schema: 'public',
                    table: 'contatos',
                    filter: `organizacao_id=eq.${organizacaoId}`
                },
                (payload) => {
                    // Se um contato mudou, recarregamos a lista de conversas para puxar o nome novo
                    console.log("Contato alterado, atualizando lista...", payload);
                    queryClient.invalidateQueries(['conversations', organizacaoId]);
                    
                    // Se o contato alterado for o que está aberto, atualizamos ele também
                    if (selectedContact?.contato_id === payload.new?.id) {
                        setSelectedContact(prev => ({
                            ...prev,
                            nome: payload.new.nome,
                            avatar_url: payload.new.foto_url
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizacaoId, queryClient, selectedContact?.contato_id]);


    const handleSelectContact = async (contact) => {
        // Ao selecionar, garantimos que estamos usando os dados mais frescos da lista
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
        <div className="flex flex-col h-full w-full bg-gray-100 overflow-hidden">
            <Toaster position="top-right" richColors />

            <div className="flex flex-shrink-0 border-b bg-white h-16 md:h-20 items-center">
                {/* Coluna Esquerda (Lista) */}
                <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 p-4 border-r flex-col justify-center h-full`}>
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-xl font-bold text-gray-800">Mensagens</h1>
                    </div>
                    {/* Barra de Pesquisa (Visual) */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar conversa..."
                            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>

                {/* Coluna Central (Chat Header) */}
                <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-grow px-4 items-center h-full bg-gray-50/50`}>
                    {selectedContact && (
                        <>
                            <button onClick={handleBackToList} className="md:hidden mr-3 text-gray-600 hover:text-gray-800">
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </button>
                            {/* Nome do Contato no Topo */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                                    {selectedContact.avatar_url ? (
                                        <img src={selectedContact.avatar_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                                            {(selectedContact.nome || '?').charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900 leading-tight">
                                        {selectedContact.nome}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        {selectedContact.phone_number}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Coluna Direita (Detalhes) */}
                <div className="hidden lg:flex p-4 items-center justify-center flex-shrink-0 w-1/4 h-full border-l">
                    {selectedContact && (
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Detalhes do Contato</h2>
                    )}
                </div>
            </div>
            
            <div className="flex flex-grow min-h-0">
                {/* Lista de Conversas */}
                <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 bg-white border-r flex-col`}>
                    <ConversationList
                        conversations={conversations}
                        isLoading={isLoadingConversations}
                        onSelectContact={handleSelectContact}
                        selectedContactId={selectedContact?.contato_id}
                    />
                </div>

                {/* Painel de Mensagens */}
                <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-[#efeae2]`}>
                    <MessagePanel 
                        contact={selectedContact}
                    />
                </div>
                
                {/* Perfil Lateral */}
                <div className="hidden lg:flex w-1/4 bg-white border-l flex-col overflow-y-auto">
                    {selectedContact && (
                       <ContactProfile contact={selectedContact} />
                    )}
                </div>
            </div>
        </div>
    );
}