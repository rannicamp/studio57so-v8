'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQueryClient, useMutation } from '@tanstack/react-query'; 
import NewConversationModal from './NewConversationModal';
import CreateBroadcastModal from './CreateBroadcastModal'; 
import { usePersistentState } from '@/hooks/usePersistentState';

// --- COMPONENTE EXTRAÍDO (ITEM DA CONVERSA) ---
const ConversationItem = ({ conversation, isSelected, onSelect, onAction, isArchivedList }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Formata Data
    const formatMessageDate = (dateString) => {
        if (!dateString) return '';
        return format(new Date(dateString), 'HH:mm', { locale: ptBR });
    };

    // Fecha o menu se clicar fora dele
    useEffect(() => {
        if (isMenuOpen) {
            const closeMenu = () => setIsMenuOpen(false);
            document.addEventListener('click', closeMenu);
            return () => document.removeEventListener('click', closeMenu);
        }
    }, [isMenuOpen]);

    return (
        <li
            onClick={() => onSelect(conversation)}
            className={`relative group p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-[#f0f2f5] border-l-4 border-l-[#00a884]' : 'bg-white'
            }`}
        >
            <div className="flex items-center">
                {/* Avatar */}
                <div className="relative">
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0">
                        {conversation.avatar_url ? (
                            <img src={conversation.avatar_url} alt="" className="w-full h-full object-cover" />
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

                {/* Info */}
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

                {/* --- BOTÃO DE MENU (Aparece no Hover da linha ou se o menu estiver aberto) --- */}
                <div className={`absolute right-2 top-4 z-20 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                        className={`flex items-center justify-center w-8 h-8 rounded-full focus:outline-none shadow-sm transition-colors ${
                            isMenuOpen ? 'bg-gray-200 text-gray-700' : 'bg-white/80 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation(); // Impede de selecionar a conversa ao clicar no botão
                            setIsMenuOpen(!isMenuOpen);
                        }}
                    >
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>

                    {/* --- MENU FLUTUANTE (Só aparece se isMenuOpen for true) --- */}
                    {isMenuOpen && (
                        <div 
                            className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-xl ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()} // Impede que cliques dentro do menu fechem ele ou selecionem a conversa
                        >
                            <div className="py-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
                                        onAction(isArchivedList ? 'unarchive' : 'archive', conversation);
                                    }}
                                    className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                >
                                    <FontAwesomeIcon icon={isArchivedList ? faInbox : faArchive} className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                                    {isArchivedList ? 'Desarquivar' : 'Arquivar'}
                                </button>
                                
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
                                        onAction('delete', conversation);
                                    }}
                                    className="group flex w-full items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="mr-3 h-4 w-4 text-red-500" />
                                    Excluir
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
};

// --- ITEM DE LISTA DE TRANSMISSÃO ---
const BroadcastListItem = ({ list, onSelect, onDelete, isSelected }) => (
    <li 
      onClick={() => onSelect(list)}
      className={`relative group p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors bg-white ${
          isSelected ? 'bg-[#f0f2f5] border-l-4 border-l-blue-500' : ''
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
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(list.id); }}
                className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Excluir Lista"
            >
                <FontAwesomeIcon icon={faTrash} />
            </button>
        </div>
    </li>
);

// --- COMPONENTE PRINCIPAL ---
export default function ConversationList({ conversations, broadcastLists, isLoading, onSelectContact, selectedContactId, onSelectList, selectedListId }) {
  const [activeTab, setActiveTab] = usePersistentState('whatsapp_active_tab', 'chats'); 
  const [showArchived, setShowArchived] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // --- MUTATION PARA GERENCIAR AÇÕES (Delete/Archive) ---
  const conversationMutation = useMutation({
    mutationFn: async ({ action, conversationId }) => {
        const response = await fetch('/api/whatsapp/chat-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                conversationId,
            })
        });

        // Verificação segura se a resposta é JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("O servidor retornou uma resposta inválida (provavelmente erro 404 ou 500). Verifique a rota da API.");
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao processar ação');
        }
        return { ...data, action };
    },
    onSuccess: (data) => {
        const actionMsg = data.action === 'delete' ? 'Conversa excluída!' : data.action === 'archive' ? 'Arquivada!' : 'Recuperada!';
        toast.success(actionMsg);
        
        // Força atualização das listas
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        
        // Se excluiu a conversa ativa, limpa a seleção
        if (data.action === 'delete') {
            onSelectContact(null);
        }
    },
    onError: (error) => {
        console.error(error);
        toast.error(`Erro: ${error.message}`);
    }
  });

  // --- MUTATION PARA DELETAR LISTA ---
  const deleteListMutation = useMutation({
      mutationFn: async (listId) => {
          const response = await fetch(`/api/whatsapp/lists?id=${listId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error("Erro ao excluir lista");
          return listId;
      },
      onSuccess: (listId) => {
          toast.success("Lista excluída.");
          queryClient.invalidateQueries({ queryKey: ['broadcastLists'] });
          if (selectedListId === listId && onSelectList) onSelectList(null);
      },
      onError: () => toast.error("Erro ao excluir lista.")
  });

  // Função Wrapper para chamar a mutation
  const handleAction = async (action, conversation) => {
    if (action === 'delete') {
        if (!confirm('Tem certeza? Isso apagará TODO o histórico de mensagens permanentemente.')) return;
    }
    
    const targetId = conversation.conversation_id || conversation.id;
    if (!targetId) {
        toast.error("Erro: ID da conversa inválido.");
        return;
    }

    conversationMutation.mutate({ action, conversationId: targetId });
  };

  const handleDeleteList = async (listId) => {
    if (!confirm("Excluir esta lista de transmissão?")) return;
    deleteListMutation.mutate(listId);
  };

  const handleCreateAction = () => {
      if (activeTab === 'chats') setIsNewChatOpen(true);
      else setIsNewListOpen(true);
  };

  const handleListCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['broadcastLists'] });
  };

  if (isLoading) return <div className="flex justify-center p-8 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" /></div>;

  const activeConversations = conversations?.filter(c => !c.is_archived) || [];
  const archivedConversations = conversations?.filter(c => c.is_archived) || [];

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
                <button onClick={handleCreateAction} className="w-8 h-8 mb-2 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:bg-[#008f6f] transition-colors shadow-sm"><FontAwesomeIcon icon={faPlus} /></button>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
            {activeTab === 'chats' && (
                (!conversations || conversations.length === 0) ? (
                    <div className="p-6 text-center text-gray-500"><p className="mb-4">Nenhuma conversa encontrada.</p><button onClick={() => setIsNewChatOpen(true)} className="text-[#00a884] font-medium hover:underline">Iniciar nova conversa</button></div>
                ) : (
                    <>
                        <ul className="flex-grow">
                            {activeConversations.map((c) => (
                                <ConversationItem 
                                    key={c.conversation_id || c.id} 
                                    conversation={c} 
                                    isSelected={selectedContactId === (c.contato_id || c.conversation_id)}
                                    onSelect={onSelectContact}
                                    onAction={handleAction}
                                />
                            ))}
                        </ul>
                        {archivedConversations.length > 0 && (
                            <div className="border-t border-gray-200 mt-2">
                                <button onClick={() => setShowArchived(!showArchived)} className="w-full flex items-center justify-between p-4 text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium">
                                    <div className="flex items-center gap-2"><FontAwesomeIcon icon={faBoxOpen} /> Arquivadas ({archivedConversations.length})</div><FontAwesomeIcon icon={showArchived ? faChevronDown : faChevronRight} size="xs"/>
                                </button>
                                {showArchived && <ul className="bg-gray-50 animate-in slide-in-from-top-2 duration-200">
                                    {archivedConversations.map((c) => (
                                        <ConversationItem 
                                            key={c.conversation_id || c.id} 
                                            conversation={c} 
                                            isArchivedList={true}
                                            isSelected={selectedContactId === (c.contato_id || c.conversation_id)}
                                            onSelect={onSelectContact}
                                            onAction={handleAction}
                                        />
                                    ))}
                                </ul>}
                            </div>
                        )}
                    </>
                )
            )}
            {activeTab === 'lists' && (
                (!broadcastLists || broadcastLists.length === 0) ? (
                    <div className="p-6 text-center text-gray-500"><div className="mb-4 text-gray-300 text-4xl"><FontAwesomeIcon icon={faBullhorn} /></div><p className="mb-2">Nenhuma lista de transmissão.</p><p className="text-xs text-gray-400">Crie listas para filtrar e enviar mensagens em massa.</p><button onClick={() => setIsNewListOpen(true)} className="mt-4 text-[#00a884] font-medium hover:underline">Criar primeira lista</button></div>
                ) : <ul className="flex-grow">
                    {broadcastLists.map((list) => (
                        <BroadcastListItem 
                            key={list.id} 
                            list={list} 
                            isSelected={selectedListId === list.id}
                            onSelect={onSelectList}
                            onDelete={handleDeleteList}
                        />
                    ))}
                </ul>
            )}
        </div>
    </div>
  );
}