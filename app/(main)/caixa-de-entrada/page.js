// app/(main)/caixa-de-entrada/page.js
'use client'

import { useState } from 'react';
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

    const { data: conversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchInterval: 30000,
        refetchOnWindowFocus: true,
    });

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
        // =================================================================================
        // ATUALIZAÇÃO FINAL: O componente agora é limpo e simples.
        // O PORQUÊ: Como o layout.js agora nos dá um espaço limpo, não precisamos
        // mais de margens negativas ou cálculos de altura. O 'h-full' faz com que
        // ele ocupe todo o espaço vertical corretamente posicionado.
        // =================================================================================
        <div className="flex flex-col h-full w-full bg-gray-100 overflow-hidden">
            <Toaster position="top-right" richColors />

            <div className="flex flex-shrink-0 border-b bg-white h-24">
                <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 p-4 border-r flex-col justify-center`}>
                    <h1 className="text-xl font-bold">Caixa de Entrada</h1>
                    <div className="relative mt-1">
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-grow p-4 items-center border-r`}>
                    {selectedContact && (
                        <>
                            <button onClick={handleBackToList} className="md:hidden mr-3 text-gray-600 hover:text-gray-800">
                                <FontAwesomeIcon icon={faArrowLeft} size="lg" />
                            </button>
                            <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white shrink-0">
                                {selectedContact.nome?.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="font-semibold truncate">{selectedContact.nome}</h2>
                        </>
                    )}
                </div>

                <div className="hidden lg:flex p-4 items-center flex-shrink-0 w-1/4">
                    {selectedContact && (
                        <h2 className="text-lg font-bold">Perfil do Contato</h2>
                    )}
                </div>
            </div>
            
            <div className="flex flex-grow min-h-0">
                <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 bg-white border-r flex-col`}>
                    <ConversationList
                        conversations={conversations}
                        isLoading={isLoadingConversations}
                        onSelectContact={handleSelectContact}
                        selectedContactId={selectedContact?.contato_id}
                    />
                </div>

                <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-grow flex-col`}>
                    <MessagePanel 
                        contact={selectedContact}
                    />
                </div>
                
                <div className="hidden lg:flex w-1/4 bg-white border-l flex-col">
                    {selectedContact && (
                       <ContactProfile contact={selectedContact} />
                    )}
                </div>
            </div>
        </div>
    );
}