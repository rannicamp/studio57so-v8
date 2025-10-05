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

    const isCotacoesBarVisible = user?.mostrar_barra_cotacoes && user?.cotacoes_visiveis?.length > 0;
    const headerHeight = isCotacoesBarVisible ? '113px' : '89px';

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
        <div 
            className="flex flex-col w-full bg-gray-100 overflow-hidden ml-[-24px] mr-[-24px]"
            style={{ height: `calc(100vh - ${headerHeight})` }}
        >
            <Toaster position="top-right" richColors />

            {/* ================================================================= */}
            {/* PARTE 1: O NOVO CABEÇALHO FIXO DA PÁGINA                       */}
            {/* ================================================================= */}
            <div className="flex flex-shrink-0 border-b bg-white">
                {/* Cabeçalho da Coluna 1: Lista de Conversas */}
                <div className="w-full md:w-1/3 lg:w-1/4 p-4 border-r">
                    <h1 className="text-xl font-bold">Caixa de Entrada</h1>
                    <div className="relative mt-4">
                        <input
                            type="text"
                            placeholder="Pesquisar ou começar uma nova conversa"
                            className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {/* Cabeçalho da Coluna 2: Painel de Mensagens */}
                <div className="flex-grow p-3 flex items-center border-r">
                    {selectedContact && (
                        <>
                            <button onClick={handleBackToList} className="md:hidden mr-3 text-gray-600 hover:text-gray-800">
                                <FontAwesomeIcon icon={faArrowLeft} size="lg" />
                            </button>
                            <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white">
                                {selectedContact.nome?.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="font-semibold">{selectedContact.nome}</h2>
                        </>
                    )}
                </div>

                {/* Cabeçalho da Coluna 3: Perfil do Contato */}
                <div className="hidden lg:block flex-shrink-0 w-1/4 p-4">
                    {selectedContact && (
                        <h2 className="text-lg font-bold">Perfil do Contato</h2>
                    )}
                </div>
            </div>

            {/* ================================================================= */}
            {/* PARTE 2: A NOVA ÁREA DE CONTEÚDO                             */}
            {/* ================================================================= */}
            <div className="flex flex-grow min-h-0">
                {/* Conteúdo da Coluna 1 */}
                <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r">
                    <ConversationList
                        conversations={conversations}
                        isLoading={isLoadingConversations}
                        onSelectContact={handleSelectContact}
                        selectedContactId={selectedContact?.contato_id}
                    />
                </div>

                {/* Conteúdo da Coluna 2 */}
                <div className="flex-grow">
                    <MessagePanel 
                        contact={selectedContact}
                        onBack={handleBackToList}
                    />
                </div>

                {/* Conteúdo da Coluna 3 */}
                {selectedContact && (
                    <div className="hidden lg:block flex-shrink-0 w-1/4 bg-white border-l">
                        <ContactProfile contact={selectedContact} />
                    </div>
                )}
            </div>
        </div>
    );
}