// components/WhatsAppChatManager.js
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle, faSearch, faComments, faAddressBook, faRobot } from '@fortawesome/free-solid-svg-icons';

// Componente para exibir o balão de mensagem
const MessageBubble = ({ message }) => {
    const isSentByUser = message.direction === 'outbound';
    
    const bubbleClasses = isSentByUser
        ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg'
        : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            <p className="text-sm">{message.content}</p>
            <p className="text-xs mt-1 text-right opacity-70">
                {new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
};

// Componente Placeholder para o Assistente de IA
const AIChatAssistant = ({ selectedContact }) => {
    return (
        <div className="p-4 space-y-4 bg-white border-l border-gray-200">
            <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faRobot} /> Assistente de IA
            </h3>
            <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">
                {selectedContact ? (
                    <p>A IA monitorará a conversa com **{selectedContact.nome || selectedContact.razao_social}** e fornecerá sugestões aqui.</p>
                ) : (
                    <p>Selecione um contato para ativar o assistente de IA.</p>
                )}
            </div>
        </div>
    );
}

export default function WhatsAppChatManager({ contatos }) {
    const supabase = createClient();
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const chatEndRef = useRef(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('conversas');
    const [lastMessageDates, setLastMessageDates] = useState(new Map());

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchActiveConversationData = useCallback(async () => {
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('contato_id, sent_at')
            .neq('contato_id', null)
            .order('sent_at', { ascending: false });

        if (error) {
            console.error("Erro ao buscar dados de conversas ativas:", error);
            return;
        }

        const datesMap = new Map();
        data.forEach(msg => {
            const contactIdStr = String(msg.contato_id);
            if (contactIdStr && !datesMap.has(contactIdStr)) {
                datesMap.set(contactIdStr, new Date(msg.sent_at));
            }
        });
        setLastMessageDates(datesMap);
    }, [supabase]);

    useEffect(() => {
        fetchActiveConversationData();
    }, [fetchActiveConversationData]);

    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact);
        setLoadingMessages(true);
        setMessages([]);
        setNewMessage('');

        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id)
            .order('sent_at', { ascending: true });

        if (error) {
            console.error("Erro ao buscar o histórico de mensagens:", error);
        } else {
            setMessages(data || []);
        }
        setLoadingMessages(false);
    }, [supabase]);
    
    useEffect(() => {
        if (!selectedContact) return;

        const channel = supabase
            .channel(`realtime_whatsapp_for_${selectedContact.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: '*',
                    schema: 'public', 
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${selectedContact.id}`
                },
                (payload) => {
                    handleSelectContact(selectedContact);
                    fetchActiveConversationData();
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedContact, supabase, handleSelectContact, fetchActiveConversationData]);

    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;
        
        const phoneNumber = selectedContact.telefones?.[0]?.telefone;
        if (!phoneNumber) {
            alert("Este contato não possui um número de telefone cadastrado.");
            return;
        }

        setIsSending(true);
        const textToSend = newMessage;
        setNewMessage('');
        
        try {
            const response = await fetch('/api/whatsapp/send', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phoneNumber,
                    type: 'text',
                    text: textToSend
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                alert(`Erro ao enviar mensagem: ${result.error || 'Erro desconhecido'}`);
                setNewMessage(textToSend); 
            }
        } catch (error) {
            alert(`Erro na comunicação com a API: ${error.message}`);
            setNewMessage(textToSend);
        } finally {
            setIsSending(false);
        }
    };

    // LÓGICA DE FILTRAGEM CORRIGIDA
    const allContactsList = useMemo(() => {
        if (!searchTerm) return contatos;
        const term = searchTerm.toLowerCase();
        return contatos.filter(contact => {
            const name = (contact.nome || contact.razao_social || '').toLowerCase();
            const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase();
            return name.includes(term) || phone.includes(term);
        });
    }, [contatos, searchTerm]);

    const activeConversationsList = useMemo(() => {
        // 1. Primeiro, pega apenas os contatos que têm mensagens
        const contactsWithMessages = contatos
            .filter(contact => lastMessageDates.has(String(contact.id)))
            .map(contact => ({
                ...contact,
                lastMessageDate: lastMessageDates.get(String(contact.id))
            }))
            .sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());

        // 2. Depois, aplica o filtro de busca sobre essa lista
        if (!searchTerm) return contactsWithMessages;
        const term = searchTerm.toLowerCase();
        return contactsWithMessages.filter(contact => {
            const name = (contact.nome || contact.razao_social || '').toLowerCase();
            const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase();
            return name.includes(term) || phone.includes(term);
        });
    }, [contatos, lastMessageDates, searchTerm]);
    // FIM DA CORREÇÃO

    return (
        <div className="grid grid-cols-[250px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
            {/* Coluna 1: Lista de Contatos */}
            <div className="flex flex-col border-r">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-2">Contatos</h2>
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full p-2 pl-9 border rounded-md text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex border-b text-sm">
                    <button
                        onClick={() => setActiveTab('conversas')}
                        className={`flex-1 p-3 text-center border-b-2 ${activeTab === 'conversas' ? 'border-blue-500 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FontAwesomeIcon icon={faComments} className="mr-2" />
                        Conversas ({activeConversationsList.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('todos')}
                        className={`flex-1 p-3 text-center border-b-2 ${activeTab === 'todos' ? 'border-blue-500 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FontAwesomeIcon icon={faAddressBook} className="mr-2" />
                        Todos ({allContactsList.length})
                    </button>
                </div>
                <ul className="overflow-y-auto flex-1">
                    {(activeTab === 'conversas' ? activeConversationsList : allContactsList).map(contact => (
                        <li
                            key={contact.id}
                            onClick={() => handleSelectContact(contact)}
                            className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''}`}
                        >
                            <p className="font-semibold">{contact.nome || contact.razao_social}</p>
                            <p className="text-sm text-gray-500">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                            {contact.lastMessageDate && activeTab === 'conversas' && (
                                <p className="text-xs text-gray-400 mt-1">
                                    {contact.lastMessageDate.toLocaleDateString('pt-BR')} {contact.lastMessageDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Coluna 2: Área de Mensagens */}
            <div className="flex flex-col">
                {selectedContact ? (
                    <>
                        <div className="p-4 border-b flex items-center gap-3">
                            <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />
                            <div>
                                <h3 className="font-bold">{selectedContact.nome || selectedContact.razao_social}</h3>
                                <p className="text-sm text-gray-500">{selectedContact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                            </div>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col">
                            {loadingMessages ? (
                                <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>
                            ) : (
                                messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 border-t flex items-center gap-3 bg-white">
                           <input 
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }}
                                placeholder="Digite uma mensagem..."
                                className="flex-1 p-2 border rounded-full"
                           />
                            <button
                                onClick={handleSendMessage}
                                disabled={isSending || !newMessage.trim()}
                                className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400"
                            >
                                {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Selecione um contato para ver as mensagens.</p>
                    </div>
                )}
            </div>

            {/* Coluna 3: Assistente de IA */}
            <AIChatAssistant selectedContact={selectedContact} />
        </div>
    );
}