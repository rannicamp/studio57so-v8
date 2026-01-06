// components/whatsapp/ConversationList.js
'use client';

import React, { useState, useEffect } from 'react';
import { format, addHours, differenceInMinutes } from 'date-fns';
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
  faTag,
  faFilter,
  faClipboardList,
  faClock,
  faExclamationCircle // Ícone de alerta
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQueryClient, useMutation } from '@tanstack/react-query'; 
import NewConversationModal from './NewConversationModal';
import CreateBroadcastModal from './CreateBroadcastModal'; 
import QuickCardModal from './QuickCardModal';
import { usePersistentState } from '@/hooks/usePersistentState';
import { formatPhoneNumber } from '@/utils/formatters';

// --- COMPONENTE DO CRONÔMETRO DA JANELA ---
const ServiceWindowTimer = ({ lastInboundAt }) => {
    const [timeLeftLabel, setTimeLeftLabel] = useState(null);
    const [isClosed, setIsClosed] = useState(false);

    useEffect(() => {
        if (!lastInboundAt) {
            setIsClosed(true);
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const windowStart = new Date(lastInboundAt);
            const windowEnd = addHours(windowStart, 24);
            const minutesLeft = differenceInMinutes(windowEnd, now);

            if (minutesLeft <= 0) {
                setIsClosed(true);
                setTimeLeftLabel(null);
            } else {
                setIsClosed(false);
                const h = Math.floor(minutesLeft / 60);
                const m = minutesLeft % 60;
                setTimeLeftLabel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }, [lastInboundAt]);

    if (isClosed) {
        return (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1 max-w-full truncate" title="Janela de 24h fechada">
                <FontAwesomeIcon icon={faClock} className="text-[9px] opacity-50" />
                Janela Fechada
            </span>
        );
    }

    return (
        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1 max-w-full truncate" title="Tempo restante na janela de 24h">
            <FontAwesomeIcon icon={faClock} className="text-[9px]" />
            {timeLeftLabel}
        </span>
    );
};

// --- COMPONENTE ITEM DA CONVERSA ---
const ConversationItem = ({ conversation, isSelected, onSelect, onAction, isArchivedList }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const contactName = conversation.contatos?.nome || conversation.nome || formatPhoneNumber(conversation.phone_number || conversation.customer_phone || '');
    const isFailed = conversation.last_message_status === 'failed';

    const formatMessageDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const isToday = new Date().toDateString() === date.toDateString();
        return isToday ? format(date, 'HH:mm', { locale: ptBR }) : format(date, 'dd/MM', { locale: ptBR });
    };

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
            <div className="flex items-start">
                {/* Avatar */}
                <div className="relative mt-1">
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0">
                        {conversation.avatar_url ? (
                            <img src={conversation.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            (contactName || '?').charAt(0).toUpperCase()
                        )}
                    </div>
                    {conversation.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 bg-[#00a884] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                            {conversation.unread_count}
                        </div>
                    )}
                    {/* Indicador de Falha no Avatar */}
                    {isFailed && (
                        <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white" title="Envio Falhou">
                            !
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="ml-4 flex-grow min-w-0 pr-8">
                    <div className="flex justify-between items-baseline">
                        <h3 className={`font-semibold truncate pr-2 text-sm ${isFailed ? 'text-red-600' : 'text-gray-900'}`}>
                            {contactName}
                        </h3>
                        {conversation.last_message_at && (
                            <span className={`text-xs flex-shrink-0 ${conversation.unread_count > 0 ? 'text-[#00a884] font-bold' : 'text-gray-400'}`}>
                                {formatMessageDate(conversation.last_message_at)}
                            </span>
                        )}
                    </div>

                    <div className="flex justify-between items-center mt-0.5">
                        <p className={`text-sm truncate w-full ${isFailed ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                            {isFailed ? 
                                <span><FontAwesomeIcon icon={faExclamationCircle} className="mr-1"/> Falha no envio</span> 
                                : 
                                (conversation.last_message_content || 'Inicie uma conversa')
                            }
                        </p>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <ServiceWindowTimer lastInboundAt={conversation.last_inbound_at} />

                        {conversation.etapa_funil && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 max-w-full truncate">
                                <FontAwesomeIcon icon={faFilter} className="text-[9px] opacity-70" />
                                {conversation.etapa_funil}
                            </span>
                        )}
                        
                        {conversation.tipo_contato && (
                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-wide">
                                {conversation.tipo_contato}
                            </span>
                        )}
                    </div>
                </div>

                {/* --- MENU DE AÇÕES --- */}
                <div className={`absolute right-2 top-4 z-20 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                        className={`flex items-center justify-center w-8 h-8 rounded-full focus:outline-none shadow-sm transition-colors ${
                            isMenuOpen ? 'bg-gray-200 text-gray-700' : 'bg-white/80 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                    >
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>

                    {isMenuOpen && (
                        <div 
                            className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-xl ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="py-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
                                        onAction('create_card', conversation);
                                    }}
                                    className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600"
                                >
                                    <FontAwesomeIcon icon={faClipboardList} className="mr-3 h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                                    Criar Card
                                </button>

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

// --- COMPONENTE ITEM DA LISTA DE TRANSMISSÃO ---
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

export default function ConversationList({ conversations, broadcastLists, isLoading, onSelectContact, selectedContactId, onSelectList, selectedListId }) {
  // Estado padrão: 'chats'
  const [activeTab, setActiveTab] = usePersistentState('whatsapp_active_tab', 'chats'); 
  const [showArchived, setShowArchived] = useState(false);
  
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardTargetConversation, setCardTargetConversation] = useState(null);
  
  const queryClient = useQueryClient();

  const conversationMutation = useMutation({
    mutationFn: async ({ action, conversationId }) => {
        const response = await fetch('/api/whatsapp/chat-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, conversationId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao processar ação');
        return { ...data, action };
    },
    onSuccess: (data) => {
        const actionMsg = data.action === 'delete' ? 'Conversa excluída!' : data.action === 'archive' ? 'Arquivada!' : 'Recuperada!';
        toast.success(actionMsg);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        if (data.action === 'delete') onSelectContact(null);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

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

  const handleAction = async (action, conversation) => {
    if (action === 'create_card') {
        if (!conversation.contato_id) {
            toast.error("Salve este contato antes de criar um card.");
            return;
        }
        setCardTargetConversation(conversation);
        setIsCardModalOpen(true);
        return;
    }

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
      if (activeTab === 'lists') setIsNewListOpen(true);
      else setIsNewChatOpen(true);
  };

  const handleCardCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  if (isLoading) return <div className="flex justify-center p-8 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" /></div>;

  // Filtros
  const activeConversations = conversations?.filter(c => !c.is_archived) || [];
  const archivedConversations = conversations?.filter(c => c.is_archived) || [];
  
  // NOVA LISTA: Conversas onde a última mensagem falhou
  const failedConversations = conversations?.filter(c => c.last_message_status === 'failed') || [];

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
            onListCreated={() => queryClient.invalidateQueries({ queryKey: ['broadcastLists'] })}
        />
        <QuickCardModal
            isOpen={isCardModalOpen}
            onClose={() => setIsCardModalOpen(false)}
            conversation={cardTargetConversation}
            onSuccess={handleCardCreated}
        />

        {/* --- ABAS --- */}
        <div className="border-b bg-gray-50 shrink-0">
            <div className="flex items-center justify-between p-3 pb-0">
                <div className="flex gap-4">
                    <button onClick={() => setActiveTab('chats')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chats' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Conversas</button>
                    <button onClick={() => setActiveTab('lists')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lists' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Listas</button>
                    
                    {/* NOVA ABA FALHAS */}
                    <button onClick={() => setActiveTab('failures')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'failures' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-500 hover:text-red-500'}`}>
                        Falhas
                        {failedConversations.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{failedConversations.length}</span>
                        )}
                    </button>
                </div>
                <button onClick={handleCreateAction} className="w-8 h-8 mb-2 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:bg-[#008f6f] transition-colors shadow-sm"><FontAwesomeIcon icon={faPlus} /></button>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
            
            {/* --- CONTEÚDO: CONVERSAS --- */}
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

            {/* --- CONTEÚDO: LISTAS DE TRANSMISSÃO --- */}
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

            {/* --- CONTEÚDO: FALHAS --- */}
            {activeTab === 'failures' && (
                failedConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                        <FontAwesomeIcon icon={faExclamationCircle} className="text-4xl mb-4 text-green-200" />
                        <p className="font-medium text-gray-500">Tudo certo por aqui!</p>
                        <p className="text-xs text-center mt-2">Nenhuma falha de envio pendente.</p>
                    </div>
                ) : (
                    <ul className="flex-grow">
                        {failedConversations.map((c) => (
                            <ConversationItem 
                                key={c.conversation_id || c.id} 
                                conversation={c} 
                                isSelected={selectedContactId === (c.contato_id || c.conversation_id)}
                                onSelect={onSelectContact}
                                onAction={handleAction}
                            />
                        ))}
                    </ul>
                )
            )}
        </div>
    </div>
  );
}