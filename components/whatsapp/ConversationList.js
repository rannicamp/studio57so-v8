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
  faPlus, 
  faSpinner, 
  faBullhorn, 
  faUserCircle 
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query'; 
import NewConversationModal from './NewConversationModal';
import CreateBroadcastModal from './CreateBroadcastModal'; 
import { usePersistentState } from '@/hooks/usePersistentState';

export default function ConversationList({ conversations, broadcastLists, isLoading, onSelectContact, selectedContactId, onSelectList, selectedListId }) {
  const [activeTab, setActiveTab] = usePersistentState('whatsapp_active_tab', 'chats'); 
  
  const [showArchived, setShowArchived] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const supabase = createClient();

  // --- AÇÃO DE CONVERSA (CHAT) ---
  const handleAction = async (action, conversation, e) => {
    e.stopPropagation(); 

    if (action === 'delete') {
        if (!confirm('Tem certeza? Isso apagará TODO o histórico de mensagens dessa conversa permanentemente.')) return;
    }

    try {
        const targetId = conversation.conversation_id || conversation.id;
        const response = await fetch('/api/whatsapp/chat-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                conversationId: targetId,
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

  // --- NOVO: AÇÃO DE EXCLUIR LISTA ---
  const handleDeleteList = async (listId, e) => {
    e.stopPropagation(); // Não abre a lista ao clicar na lixeira
    if (!confirm("Tem certeza que deseja excluir esta lista de transmissão?")) return;

    try {
        const response = await fetch(`/api/whatsapp/lists?id=${listId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Erro ao excluir");
        
        toast.success("Lista excluída.");
        queryClient.invalidateQueries({ queryKey: ['broadcastLists'] });
        
        // Se a lista excluída estava aberta, fecha o painel
        if (selectedListId === listId && onSelectList) {
            onSelectList(null);
        }
    } catch (error) {
        toast.error("Erro: " + error.message);
    }
  };

  const handleCreateAction = () => {
      if (activeTab === 'chats') {
          setIsNewChatOpen(true);
      } else {
          setIsNewListOpen(true);
      }
  };

  const handleListCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['broadcastLists'] });
  };

  const formatMessageDate = (dateString) => {
      if (!dateString) return '';
      return format(new Date(dateString), 'HH:mm', { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8 text-gray-500">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" />
      </div>
    );
  }

  const activeConversations = conversations?.filter(c => !c.is_archived) || [];
  const archivedConversations = conversations?.filter(c => c.is_archived) || [];

  // --- COMPONENTE: ITEM DE CONVERSA ---
  const ConversationItem = ({ conversation, isArchivedList = false }) => {
    const uniqueId = conversation.conversation_id || conversation.id;
    const isSelected = selectedContactId === conversation.contato_id || selectedContactId === uniqueId;

    return (
        <li
        onClick={() => onSelectContact(conversation)}
        className={`relative group p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
            isSelected ? 'bg-[#f0f2f5] border-l-4 border-l-[#00a884]' : 'bg-white'
        }`}
        >
        <div className="flex items-center">
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

            <div className="ml-4 flex-grow min-w-0 pr-8">
            <div className="flex justify-between items-baseline">
                <h3 className="font-semibold text-gray-900 truncate pr-2 text-sm">
                {conversation.nome || conversation.phone_number}
                </h3>
                {conversation.last_message_at && (
                <span className={`text-xs flex-shrink-0 ${conversation.unread_count > 0 ? 'text-[#00a884] font-bold' : 'text-gray-400'}`}>
                    {formatMessageDate(conversation.last_message_at)}
                </span>
                )}
            </div>
            <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500 truncate w-full">
                {conversation.last_message_content || 'Inicie uma conversa'}
                </p>
            </div>
            </div>

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
                                            className={`${active ? 'bg-blue-500 text-white' : 'text-gray-900'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
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
                                            className={`${active ? 'bg-red-500 text-white' : 'text-red-600'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
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
  };

  // --- COMPONENTE: ITEM DE LISTA DE TRANSMISSÃO (Com Lixeira) ---
  const BroadcastListItem = ({ list }) => (
      <li 
        onClick={() => onSelectList && onSelectList(list)}
        className={`relative group p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors bg-white ${
            selectedListId === list.id ? 'bg-[#f0f2f5] border-l-4 border-l-blue-500' : ''
        }`}
      >
          <div className="flex items-center justify-between">
              <div className="flex items-center overflow-hidden">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl shrink-0">
                      <FontAwesomeIcon icon={faBullhorn} />
                  </div>
                  <div className="ml-4 flex-grow min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm">{list.nome}</h3>
                      <p className="text-xs text-gray-500 truncate">
                          {list.membros_count || 0} destinatários • {list.descricao || 'Sem descrição'}
                      </p>
                  </div>
              </div>
              
              {/* Botão de Excluir (Aparece no Hover) */}
              <button 
                onClick={(e) => handleDeleteList(list.id, e)}
                className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Excluir Lista"
              >
                  <FontAwesomeIcon icon={faTrash} />
              </button>
          </div>
      </li>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
        <NewConversationModal 
            isOpen={isNewChatOpen} 
            onClose={() => setIsNewChatOpen(false)}
            onConversationCreated={(contact) => { onSelectContact(contact); }}
        />
        <CreateBroadcastModal
            isOpen={isNewListOpen}
            onClose={() => setIsNewListOpen(false)}
            onListCreated={handleListCreated}
        />

        <div className="border-b bg-gray-50 shrink-0">
            <div className="flex items-center justify-between p-3 pb-0">
                <div className="flex gap-4">
                    <button onClick={() => setActiveTab('chats')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chats' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Conversas</button>
                    <button onClick={() => setActiveTab('lists')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lists' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Listas</button>
                </div>
                <button onClick={handleCreateAction} className="w-8 h-8 mb-2 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:bg-[#008f6f] transition-colors shadow-sm" title={activeTab === 'chats' ? "Nova Conversa" : "Nova Lista"}><FontAwesomeIcon icon={faPlus} /></button>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
            {activeTab === 'chats' && (
                (!conversations || conversations.length === 0) ? (
                    <div className="p-6 text-center text-gray-500"><p className="mb-4">Nenhuma conversa encontrada.</p><button onClick={() => setIsNewChatOpen(true)} className="text-[#00a884] font-medium hover:underline">Iniciar nova conversa</button></div>
                ) : (
                    <>
                        <ul className="flex-grow">{activeConversations.map((c) => <ConversationItem key={c.conversation_id || c.id} conversation={c} />)}</ul>
                        {archivedConversations.length > 0 && (
                            <div className="border-t border-gray-200 mt-2">
                                <button onClick={() => setShowArchived(!showArchived)} className="w-full flex items-center justify-between p-4 text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium">
                                    <div className="flex items-center gap-2"><FontAwesomeIcon icon={faBoxOpen} /> Arquivadas ({archivedConversations.length})</div><FontAwesomeIcon icon={showArchived ? faChevronDown : faChevronRight} size="xs"/>
                                </button>
                                {showArchived && <ul className="bg-gray-50 animate-in slide-in-from-top-2 duration-200">{archivedConversations.map((c) => <ConversationItem key={c.conversation_id || c.id} conversation={c} isArchivedList={true} />)}</ul>}
                            </div>
                        )}
                    </>
                )
            )}

            {activeTab === 'lists' && (
                (!broadcastLists || broadcastLists.length === 0) ? (
                    <div className="p-6 text-center text-gray-500">
                        <div className="mb-4 text-gray-300 text-4xl"><FontAwesomeIcon icon={faBullhorn} /></div>
                        <p className="mb-2">Nenhuma lista de transmissão.</p>
                        <p className="text-xs text-gray-400">Crie listas para filtrar e enviar mensagens em massa.</p>
                        <button onClick={() => setIsNewListOpen(true)} className="mt-4 text-[#00a884] font-medium hover:underline">Criar primeira lista</button>
                    </div>
                ) : (
                    <ul className="flex-grow">
                        {broadcastLists.map((list) => <BroadcastListItem key={list.id} list={list} />)}
                    </ul>
                )
            )}
        </div>
    </div>
  );
}