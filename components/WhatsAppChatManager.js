"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons';
// A CORREÇÃO ESTÁ AQUI: Importando a função correta do nosso novo utilitário
import { sendWhatsAppText } from '../utils/whatsapp';

// Componente para exibir uma única mensagem na conversa (sem alterações)
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

    // NOVO: Estado para guardar a mensagem que o usuário está digitando
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectContact = async (contact) => {
        setSelectedContact(contact);
        setLoadingMessages(true);
        setMessages([]);
        setNewMessage(''); // Limpa a caixa de texto ao trocar de contato

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

    // FUNÇÃO ATUALIZADA: Agora envia o texto digitado
    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;

        setIsSending(true);
        
        const phoneNumber = selectedContact.telefones[0].telefone;

        const result = await sendWhatsAppText(phoneNumber, newMessage);

        if (result.success) {
            setNewMessage(''); // Limpa a caixa de texto após o envio
            // Idealmente, recarregaríamos as mensagens aqui para ver a nova mensagem enviada
        } else {
            alert('Falha ao enviar mensagem: ' + result.error);
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
                        {/* ÁREA DE DIGITAÇÃO ATUALIZADA */}
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