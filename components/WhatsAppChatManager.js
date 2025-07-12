"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle, faSearch } from '@fortawesome/free-solid-svg-icons';
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

        const contactPhone = contact.telefones?.[0]?.telefone;
        if (!contactPhone) {
            setLoadingMessages(false);
            return;
        }

        // --- LÓGICA DE BUSCA CORRIGIDA ---
        // Agora busca todas as mensagens ONDE:
        // o remetente (sender_id) é o contato selecionado
        // OU
        // o destinatário (receiver_id) é o contato selecionado
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .or(`sender_id.eq.${contactPhone},receiver_id.eq.${contactPhone}`)
            .order('sent_at', { ascending: true }); // Ordena pela data/hora de envio

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
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'whatsapp_messages'
                },
                (payload) => {
                    // Quando uma nova mensagem chegar, recarrega o histórico para garantir a consistência
                    handleSelectContact(selectedContact);
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedContact, supabase, handleSelectContact]);

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
        
        // A mensagem aparecerá automaticamente por causa da escuta em tempo real (realtime).
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
                            className="w-full p-2 pl-9 border rounded-md text-sm"
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
        </div>
    );
}