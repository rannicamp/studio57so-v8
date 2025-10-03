// app/(main)/caixa-de-entrada/page.js
'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversations, markMessagesAsRead } from './actions'
import ConversationList from '@/components/whatsapp/ConversationList' // <-- CAMINHO ATUALIZADO
import MessagePanel from '@/components/whatsapp/MessagePanel' // <-- CAMINHO ATUALIZADO
import ContactProfile from '@/components/whatsapp/ContactProfile' // <-- CAMINHO ATUALIZADO
import { Toaster, toast } from 'sonner'

export default function CaixaDeEntrada() {
  const [selectedContact, setSelectedContact] = useState(null)
  const queryClient = useQueryClient()

  // Busca a lista de conversas com React Query
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    refetchInterval: 1000 * 30, // Busca novas conversas a cada 30 segundos
    refetchOnWindowFocus: true,
    onSuccess: (newData) => {
        const oldData = queryClient.getQueryData(['conversations']);
        // Evita a notificação no primeiro carregamento
        if (oldData && JSON.stringify(oldData) !== JSON.stringify(newData)) {
            toast.success('Página atualizada!');
        }
    }
  })

  const handleSelectContact = async (contact) => {
    setSelectedContact(contact)
    if (contact.unread_count > 0) {
      await markMessagesAsRead(contact.contato_id)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }
  
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
  )
}