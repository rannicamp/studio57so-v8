'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEllipsisV, 
  faArchive, 
  faTrash, 
  faBoxOpen, 
  faInbox,
  faChevronDown,
  faChevronRight,
  faPlus, // Adicionado
  faSpinner // Adicionado
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query'; 
import NewConversationModal from './NewConversationModal'; // Importação do Modal

export default function ConversationList({ conversations, isLoading, onSelectContact, selectedContactId }) {
  const [showArchived, setShowArchived] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false); // Estado do Modal
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Função para chamar a API
  const handleAction = async (action, conversation, e) => {
    e.stopPropagation(); 

    if (action === 'delete') {
        if (!confirm('Tem certeza? Isso apagará TODO o histórico de mensagens dessa conversa permanentemente.')) return;
    }

    try {
        const response = await fetch('/api/whatsapp/chat-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                conversationId: conversation.conversation_id || conversation.id, // Garante pegar o ID certo
                phoneNumber: conversation.phone_number
            })
        });

        if (!response.ok) throw new Error('Erro ao processar ação');

        toast.success(action === 'delete' ? 'Conversa excluída!' : action === 'archive' ? 'Conversa arquivada!' : 'Conversa recuperada!');
        
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });

    } catch (error) {
        console.error(error);
        toast.error('Erro ao realizar ação.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8 text-gray-500">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" />
      </div>
    );
  }

  // Separar Ativas de Arquivadas (Proteção contra null)
  const activeConversations = conversations?.filter(c => !c.is_archived) || [];
  const archivedConversations = conversations?.filter(c => c.is_archived) || [];

  // Componente de Item de Lista (Reutilizável)
  const ConversationItem = ({ conversation, isArchivedList = false }) => (
    <li
      onClick={() => onSelectContact(conversation)}
      className={`relative group p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
        selectedContactId === conversation.contato_id ? 'bg-[#f0f2f5] border-l-4 border-l-[#00a884]' : ''
      }`}
    >
      <div className="flex items-center">
        {/* Avatar */}
        <div className="relative">
          <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0">
            {conversation.avatar_url ? (
              <img src={conversation.avatar_url} alt={conversation.nome} className="w-full h-full object-cover" />
            ) : (
              (conversation.nome || '?').charAt(0).toUpperCase()
            )}
          </div>
          {conversation.unread_count > 0 && (
            <div className="absolute -top-1 -right-1 bg-[#00a884] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {conversation.unread_count}
            </div>
          )}
        </div>

        {/* Info da Conversa */}
        <div className="ml-4 flex-grow min-w-0 pr-8">
          <div className="flex justify-between items-baseline">
            <h3 className="font-semibold text-gray-900 truncate pr-2">
              {conversation.nome || conversation.phone_number}
            </h3>
            {conversation.last_message_at && (
              <span className={`text-xs flex-shrink-0 ${conversation.unread_count > 0 ? 'text-[#00a884] font-bold' : 'text-gray-400'}`}>
                {format(new Date(conversation.last_message_at), 'HH:mm', { locale: ptBR })}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm text-gray-500 truncate w-full">
              {conversation.last_message_content || 'Inicie uma conversa'}
            </p>
          </div>
        </div>

        {/* --- MENU DE 3 PONTINHOS --- */}
        <div className="absolute right-2 top-4">
            <Menu as="div" className="relative inline-block text-left">
                <Menu.Button 
                    className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()} 
                >
                    <FontAwesomeIcon icon={faEllipsisV} />
                </Menu.Button>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="px-1 py-1">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={(e) => handleAction(isArchivedList ? 'unarchive' : 'archive', conversation, e)}
                                        className={`${
                                            active ? 'bg-blue-500 text-white' : 'text-gray-900'
                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                    >
                                        <FontAwesomeIcon icon={isArchivedList ? faInbox : faArchive} className="mr-2 h-4 w-4" />
                                        {isArchivedList ? 'Desarquivar' : 'Arquivar'}
                                    </button>
                                )}
                            </Menu.Item>
                            
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={(e) => handleAction('delete', conversation, e)}
                                        className={`${
                                            active ? 'bg-red-500 text-white' : 'text-red-600'
                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="mr-2 h-4 w-4" />
                                        Excluir Conversa
                                    </button>
                                )}
                            </Menu.Item>
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>
        </div>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
        {/* MODAL DE NOVA CONVERSA */}
        <NewConversationModal 
            isOpen={isNewChatOpen} 
            onClose={() => setIsNewChatOpen(false)}
            onConversationCreated={(contact) => {
                onSelectContact(contact);
            }}
        />

        {/* CABEÇALHO DA LISTA (Com botão +) */}
        <div className="p-3 border-b flex items-center justify-between bg-gray-50 shrink-0">
            <h2 className="font-bold text-gray-700">Conversas</h2>
            <button 
                onClick={() => setIsNewChatOpen(true)}
                className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:bg-[#008f6f] transition-colors shadow-sm"
                title="Nova Conversa"
            >
                <FontAwesomeIcon icon={faPlus} />
            </button>
        </div>

        {/* LISTA ROLÁVEL */}
        <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
            {(!conversations || conversations.length === 0) ? (
                <div className="p-6 text-center text-gray-500">
                    <p className="mb-4">Nenhuma conversa encontrada.</p>
                    <button 
                        onClick={() => setIsNewChatOpen(true)}
                        className="text-[#00a884] font-medium hover:underline"
                    >
                        Iniciar nova conversa
                    </button>
                </div>
            ) : (
                <>
                    {/* LISTA ATIVA */}
                    <ul className="flex-grow">
                        {activeConversations.map((conversation) => (
                            <ConversationItem key={conversation.id || conversation.conversation_id} conversation={conversation} />
                        ))}
                    </ul>

                    {/* RODAPÉ ARQUIVADAS */}
                    {archivedConversations.length > 0 && (
                        <div className="border-t border-gray-200 mt-2">
                            <button 
                                onClick={() => setShowArchived(!showArchived)}
                                className="w-full flex items-center justify-between p-4 text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium"
                            >
                                <div className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={faBoxOpen} />
                                    Conversas Arquivadas ({archivedConversations.length})
                                </div>
                                <FontAwesomeIcon icon={showArchived ? faChevronDown : faChevronRight} size="xs"/>
                            </button>
                            
                            {showArchived && (
                                <ul className="bg-gray-50 animate-in slide-in-from-top-2 duration-200">
                                    {archivedConversations.map((conversation) => (
                                        <ConversationItem 
                                            key={conversation.id || conversation.conversation_id} 
                                            conversation={conversation} 
                                            isArchivedList={true} 
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
}