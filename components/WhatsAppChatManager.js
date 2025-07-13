"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle, faSearch, faComments, faAddressBook, faRobot } from '@fortawesome/free-solid-svg-icons'; // Importados novos ícones
import { sendWhatsAppText } from '../utils/whatsapp';

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

// NOVO: Componente Placeholder para o Assistente de IA
const AIChatAssistant = ({ selectedContact, conversationHistory }) => {
    // Aqui você integraria a lógica para chamar a API do Gemini
    // e exibir sugestões de resposta, resumo, etc.
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
                {/* Futuramente:
                <div className="mt-4">
                    <h4 className="font-semibold text-xs text-gray-600 mb-2">Sugestões de Resposta:</h4>
                    <button className="w-full bg-blue-100 text-blue-800 text-sm p-2 rounded-md mb-2 hover:bg-blue-200">Sim, posso te ajudar!</button>
                    <button className="w-full bg-blue-100 text-blue-800 text-sm p-2 rounded-md hover:bg-blue-200">Entendido. O que mais você precisa?</button>
                </div>
                <div className="mt-4">
                    <h4 className="font-semibold text-xs text-gray-600 mb-2">Resumo da Conversa:</h4>
                    <p className="text-xs text-gray-700">A conversa até agora aborda...</p>
                </div>
                <div className="mt-4">
                    <h4 className="font-semibold text-xs text-gray-600 mb-2">Sugestões de Ação:</h4>
                    <button className="w-full bg-green-100 text-green-800 text-sm p-2 rounded-md hover:bg-green-200">Sugerir Atividade</button>
                </div>
                */}
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
    const [activeTab, setActiveTab] = useState('conversas'); // 'conversas' ou 'todos'

    // NOVO: Estado para armazenar os IDs dos contatos com conversas ativas
    const [activeConversationContactIds, setActiveConversationContactIds] = useState(new Set());

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // NOVO: Função para buscar os IDs dos contatos com mensagens
    const fetchActiveConversationContactIds = useCallback(async () => {
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('contato_id')
            .neq('contato_id', null) // Garante que só pega mensagens com contato_id preenchido
            .order('sent_at', { ascending: false }); // Pega os mais recentes primeiro

        if (error) {
            console.error("Erro ao buscar IDs de conversas ativas:", error);
            return;
        }

        // Cria um Set de IDs únicos
        const uniqueIds = new Set(data.map(msg => msg.contato_id));
        setActiveConversationContactIds(uniqueIds);
    }, [supabase]);

    useEffect(() => {
        fetchActiveConversationContactIds();
    }, [fetchActiveConversationContactIds]);


    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact);
        setLoadingMessages(true);
        setMessages([]);
        setNewMessage('');

        // CORREÇÃO: Busca mensagens pelo contato_id do contato selecionado
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id) // AGORA BUSCA PELO ID DO CONTATO
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

        // CORREÇÃO: Atualiza os filtros dos canais de realtime para usar contato_id
        const channel = supabase
            .channel(`realtime_whatsapp_for_${selectedContact.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: '*', // Escuta INSERT, UPDATE, DELETE
                    schema: 'public', 
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${selectedContact.id}` // Filtra por contato_id
                },
                (payload) => {
                    // Após qualquer alteração, recarrega o histórico e as conversas ativas
                    handleSelectContact(selectedContact);
                    fetchActiveConversationContactIds();
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedContact, supabase, handleSelectContact, fetchActiveConversationContactIds]);

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
        
        await sendWhatsAppText(phoneNumber, textToSend);
        
        // A atualização via realtime já cuidará de recarregar as mensagens
        setIsSending(false);
    };

    const filteredContacts = contatos.filter(contact => {
        const name = (contact.nome || contact.razao_social || '').toLowerCase();
        // Acessa o telefone de forma segura, se existir
        const phone = (contact.telefones && contact.telefones.length > 0 ? contact.telefones[0].telefone : '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || phone.includes(term);
    });

    // NOVO: Filtragem real para "Conversas Ativas"
    const activeConversationsList = filteredContacts.filter(contact => activeConversationContactIds.has(contact.id));
    const allContactsList = filteredContacts;

    return (
        // Layout de três colunas: lista de contatos (1/4), chat (2/4), IA (1/4)
        <div className="grid grid-cols-[250px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
            {/* Coluna 1: Lista de Contatos */}
            <div className="flex flex-col border-r">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-2">Contatos</h2>
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar por nome ou telefone..."
                            className="w-full p-2 pl-9 border rounded-md text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {/* Abas para Contatos */}
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
                            {/* Adicionar aqui um indicador de "nova mensagem" se houver */}
                        </li>
                    ))}
                     {(activeTab === 'conversas' && activeConversationsList.length === 0) && (
                        <p className="text-center text-gray-500 p-4 text-sm">Nenhuma conversa ativa.</p>
                    )}
                     {(activeTab === 'todos' && allContactsList.length === 0) && (
                        <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato encontrado.</p>
                    )}
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
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col"> {/* Adicionado flex-col para bubbles */}
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
            <AIChatAssistant selectedContact={selectedContact} conversationHistory={messages} />
        </div>
    );
}