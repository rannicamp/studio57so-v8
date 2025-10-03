// app/(main)/caixa-de-entrada/page.js
'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { getConversations, markMessagesAsRead } from './data-fetching'
import ConversationList from '@/components/whatsapp/ConversationList'
import MessagePanel from '@/components/whatsapp/MessagePanel'
import ContactProfile from '@/components/whatsapp/ContactProfile'
import { Toaster, toast } from 'sonner'

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
    refetchInterval: 30000, // a cada 30 segundos
    refetchOnWindowFocus: true,
  });

  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    if (contact.unread_count > 0) {
      await markMessagesAsRead(supabase, organizacaoId, contact.contato_id);
      queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
    }
  };
  
  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100">
      <Toaster position="top-right" richColors />
      <div className="flex-shrink-0 w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200">
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
         />
      </div>
      {selectedContact && (
        <div className="hidden lg:block flex-shrink-0 w-1/4 bg-white border-l border-gray-200">
          <ContactProfile contact={selectedContact} />
        </div>
      )}
    </div>
  );
}