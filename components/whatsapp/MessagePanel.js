// components/whatsapp/MessagePanel.js
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function MessagePanel({ contact }) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const supabase = createClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', organizacaoId, contact?.contato_id],
    queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
    enabled: !!organizacaoId && !!contact,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    if (!contact) return;

    const channel = supabase
      .channel(`whatsapp_messages_org_${organizacaoId}`)
      .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'whatsapp_messages', 
            filter: `organizacao_id=eq.${organizacaoId}` 
        }, 
        (payload) => {
            // Se a nova mensagem pertence à conversa aberta, atualiza as mensagens
            if(payload.new.contato_id === contact.contato_id) {
                queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
            }
            // Sempre atualiza a lista de conversas
            queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
            toast.info("Nova mensagem recebida!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact, organizacaoId, supabase, queryClient]);

  const sendMessageMutation = useMutation({
      mutationFn: async (messageContent) => {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: messages[0].contatos.telefone,
                message: messageContent,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao enviar mensagem');
        }
        return response.json();
      },
      onSuccess: () => {
        setNewMessage('');
      },
      onError: (error) => {
          toast.error(`Erro ao enviar: ${error.message}`);
      }
  });

  const handleSendMessage = (e) => {
      e.preventDefault();
      if (newMessage.trim() && messages && messages.length > 0) {
        sendMessageMutation.mutate(newMessage);
      }
  };

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500">
        <FontAwesomeIcon icon={faUserCircle} size="6x" />
        <p className="mt-4 text-lg">Selecione uma conversa para começar</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center p-3 border-b border-gray-200 bg-white">
        <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white">
            {contact.nome?.charAt(0).toUpperCase()}
        </div>
        <h2 className="font-semibold">{contact.nome}</h2>
      </div>
      <div className="flex-grow p-4 overflow-y-auto">
        {messages?.map(msg => (
          <div key={msg.id} className={`flex my-2 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.direction === 'outbound' ? 'bg-green-200' : 'bg-white shadow'}`}>
              <p className="text-sm">{msg.content}</p>
              <p className="text-right text-xs text-gray-500 mt-1">
                {format(new Date(msg.sent_at), 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite uma mensagem"
            className="w-full px-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sendMessageMutation.isPending}
          />
          <button type="submit" className="ml-3 p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400" disabled={sendMessageMutation.isPending}>
            {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
          </button>
        </form>
      </div>
    </div>
  );
}