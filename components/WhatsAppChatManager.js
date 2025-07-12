"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppText } from '../utils/whatsapp';

const MessageBubble = ({ message }) => {
    const isSentByUser = message.direction === 'outbound';
    const bubbleClasses = isSentByUser
        ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg'
        : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            <p className="text-sm">{message.message_content}</p>
            <p className="text-xs mt-1 text-right opacity-70">
                {new Date(message.message_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectContact = async (contact) => {
        setSelectedContact(contact);
        setLoadingMessages(true);
        setMessages([]);
        setNewMessage('');

        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id)
            .order('message_timestamp', { ascending: true });

        if (error) {
            console.error("Erro ao buscar mensagens:", error);
        } else {
            setMessages(data || []);
        }
        setLoadingMessages(false);
    };
    
    // ***** INÍCIO DA CORREÇÃO: ASSINATURA EM TEMPO REAL *****
    useEffect(() => {
        // Se nenhum contato está selecionado, não faz nada.
        if (!selectedContact) return;

        // Cria uma "assinatura" para a tabela 'whatsapp_messages'
        const channel = supabase
            .channel(`whatsapp_messages_for_${selectedContact.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT', // Escuta apenas por NOVAS mensagens
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${selectedContact.id}` // Filtra apenas para o contato selecionado
                },
                (payload) => {
                    // Quando uma nova mensagem chega, adiciona ela à lista de mensagens na tela
                    setMessages(prevMessages => [...prevMessages, payload.new]);
                }
            )
            .subscribe();

        // IMPORTANTE: Quando o componente for "desmontado" (ex: trocar de contato),
        // nós cancelamos a assinatura para não sobrecarregar o sistema.
        return () => {
            supabase.removeChannel(channel);
        };

    }, [selectedContact, supabase]);
    // ***** FIM DA CORREÇÃO *****

    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;
        setIsSending(true);
        const phoneNumber = selectedContact.telefones[0].telefone;
        const textToSend = newMessage;
        const optimisticMessage = { id: Date.now(), direction: 'outbound', message_content: textToSend, message_timestamp: new Date().toISOString(), };
        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        setNewMessage('');
        const result = await sendWhatsAppText(phoneNumber, textToSend);
        if (!result.success) {
            alert('Falha ao enviar mensagem: ' + result.error);
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticMessage.id));
        }
        setIsSending(false);
    };

    return (
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-xl border">
            <div className="w-1/3 border-r flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold">Contatos</h2>
                </div>
                <ul className="overflow-y-auto flex-1">
                    {contatos.map(contact => (
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