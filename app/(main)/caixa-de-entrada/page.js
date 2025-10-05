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
        // ##### ESTRUTURA PRINCIPAL ATUALIZADA #####
        // O container agora organiza as colunas lado a lado e impede a rolagem da página inteira
        <div className="flex h-full w-full bg-gray-100 overflow-hidden">
            <Toaster position="top-right" richColors />

            {/* --- COLUNA 1: LISTA DE CONVERSAS --- */}
            {/* Mantém a lógica de mostrar/esconder no celular */}
            <div className={`
                w-full md:w-1/3 lg:w-1/4
                bg-white border-r border-gray-200
                h-full flex flex-col
                ${selectedContact ? 'hidden md:flex' : 'flex'}
            `}>
                <ConversationList
                    conversations={conversations}
                    isLoading={isLoadingConversations}
                    onSelectContact={handleSelectContact}
                    selectedContactId={selectedContact?.contato_id}
                />
            </div>

            {/* --- COLUNA 2: PAINEL DE MENSAGEM --- */}
            {/* Ocupa o espaço central e também tem a lógica de mostrar/esconder */}
            <div className={`
                flex-grow h-full
                ${selectedContact ? 'flex' : 'hidden md:flex'}
            `}>
                <MessagePanel 
                    contact={selectedContact}
                    onBack={handleBackToList}
                />
            </div>

            {/* --- COLUNA 3: PERFIL DO CONTATO --- */}
            {/* Só aparece em telas grandes e agora também tem altura total e é uma coluna flex */}
            {selectedContact && (
                <div className="hidden lg:flex flex-shrink-0 w-1/4 bg-white border-l border-gray-200 h-full flex-col">
                    <ContactProfile contact={selectedContact} onClose={() => {}}/>
                </div>
            )}
        </div>
    );
}