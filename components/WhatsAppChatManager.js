"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle, faSearch } from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppText } from '../utils/whatsapp';

// Componente para exibir o balão de mensagem
const MessageBubble = ({ message }) => {
    // Verifica se a mensagem foi enviada por si ('outbound') ou recebida ('inbound')
    const isSentByUser = message.direction === 'outbound';
    
    // Define o estilo do balão com base em quem enviou
    const bubbleClasses = isSentByUser
        ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg'
        : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            {/* CORREÇÃO: Usa a coluna 'content' para exibir a mensagem */}
            <p className="text-sm">{message.content}</p>
            <p className="text-xs mt-1 text-right opacity-70">
                {/* CORREÇÃO: Usa a coluna 'sent_at' para exibir a hora */}
                {new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
};


export default function WhatsAppChatManager({ contatos }) {
    const supabase = createClient();
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const chatEndRef = useRef(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact);
        setLoadingMessages(true);
        setMessages([]);
        setNewMessage('');

        // Busca o histórico de mensagens para o contato selecionado
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id)
            .order('sent_at', { ascending: true }); // Ordena pela data de envio

        if (error) {
            console.error("Erro ao buscar mensagens:", error);
        } else {
            setMessages(data || []);
        }
        setLoadingMessages(false);
    }, [supabase]);
    
    // Efeito para "ouvir" novas mensagens em tempo real
    useEffect(() => {
        if (!selectedContact) return;

        const channel = supabase
            .channel(`realtime_whatsapp_messages_for_${selectedContact.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'whatsapp_messages', 
                    filter: `contato_id=eq.${selectedContact.id}` 
                },
                (payload) => {
                    // Adiciona a nova mensagem à lista de mensagens na tela
                    setMessages(prevMessages => [...prevMessages, payload.new]);
                }
            )
            .subscribe();
        
        // "Limpa" a escuta quando o usuário troca de contato
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedContact, supabase]);

    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;
        
        // Pega o primeiro telefone da lista de telefones do contato
        const phoneNumber = selectedContact.telefones?.[0]?.telefone;
        if (!phoneNumber) {
            alert("Este contato não possui um número de telefone cadastrado.");
            return;
        }

        setIsSending(true);
        const textToSend = newMessage;
        setNewMessage('');
        
        // Envia a mensagem pela nossa API
        const result = await sendWhatsAppText(phoneNumber, textToSend);

        if (!result.success) {
            alert('Falha ao enviar mensagem: ' + result.error);
        }
        // Não precisamos mais adicionar a mensagem "otimista" aqui,
        // pois a nossa API agora salva a mensagem enviada e o "realtime" a trará para a tela.
        setIsSending(false);
    };

    const filteredContacts = contatos.filter(contact => {
        const name = (contact.nome || contact.razao_social || '').toLowerCase();
        const phone = (contact.telefones?.[0]?.telefone || '');
        const term = searchTerm.toLowerCase();

        return name.includes(term) || phone.includes(term);
    });

    return (
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-xl border">
            <div className="w-1/3 border-r flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-2">Contatos</h2>
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar por nome ou telefone..."
                            className="w-full p-2 pl-9 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <ul className="overflow-y-auto flex-1">
                    {filteredContacts.map(contact => (
                        <li
                            key={contact.id}
                            onClick={() => handleSelectContact(contact)}
                            className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''}`}
                        >
                            <p className="font-semibold">{contact.nome || contact.razao_social}</p>
                            <p className="text-sm text-gray-500">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="w-2/3 flex flex-col">
                {selectedContact ? (
                    <>
                        <div className="p-4 border-b flex items-center gap-3">
                            <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />
                            <div>
                                <h3 className="font-bold">{selectedContact.nome || selectedContact.razao_social}</h3>
                                <p className="text-xs text-green-600">Online</p>
                            </div>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
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
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                                placeholder="Digite uma mensagem..."
                                className="flex-1 p-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
    );
}