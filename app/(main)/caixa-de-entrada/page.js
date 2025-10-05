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
    // ##### LÓGICA DE CONTROLE PARA CELULAR ADICIONADA AQUI #####
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

    // Nova função para lidar com o botão "voltar" no celular
    const handleBackToList = () => {
        setSelectedContact(null);
    };
    
    return (
        // A altura foi ajustada para ocupar a tela inteira corretamente
        <div className="flex h-full w-full bg-gray-100">
            <Toaster position="top-right" richColors />

            {/* --- VISÃO PARA TELAS GRANDES (DESKTOP) --- */}
            {/* Esta div só aparece em telas 'md' (médias) ou maiores */}
            <div className="hidden md:flex w-full h-full">
                <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200">
                    <ConversationList
                        conversations={conversations}
                        isLoading={isLoadingConversations}
                        onSelectContact={handleSelectContact}
                        selectedContactId={selectedContact?.contato_id}
                    />
                </div>
                <div className="flex-grow h-full">
                    <MessagePanel 
                        contact={selectedContact}
                        onBack={handleBackToList} // Passamos a função, mas ela não será usada aqui
                    />
                </div>
                {selectedContact && (
                    <div className="hidden lg:block flex-shrink-0 w-1/4 bg-white border-l border-gray-200">
                        <ContactProfile contact={selectedContact} onClose={() => {}} />
                    </div>
                )}
            </div>

            {/* --- VISÃO INTELIGENTE PARA TELAS PEQUENAS (CELULAR) --- */}
            {/* Esta div só aparece em telas pequenas (some em telas 'md' ou maiores) */}
            <div className="md:hidden w-full h-full">
                {selectedContact ? (
                    // Se uma conversa está selecionada, mostra SÓ o painel de mensagens
                    <MessagePanel 
                        contact={selectedContact} 
                        onBack={handleBackToList} // A função "voltar" é crucial aqui
                    />
                ) : (
                    // Se nenhuma conversa está selecionada, mostra SÓ a lista
                    <ConversationList
                        conversations={conversations}
                        isLoading={isLoadingConversations}
                        onSelectContact={handleSelectContact}
                        selectedContactId={null}
                    />
                )}
            </div>
        </div>
    );
}