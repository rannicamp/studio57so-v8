"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation, useChatMessages, useSendMessage, useMarkAsRead } from './ChatHooks';

export default function ChatRoom({ contact }) {
    const { user } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Hooks Padrão Ouro para comunicação Realtime
    const targetUserId = contact.isBroadcast ? null : contact.id; 
    const { data: conversationId, isLoading: loadingConv } = useConversation(targetUserId);
    const { data: messages = [], isLoading: loadingMsgs } = useChatMessages(conversationId);
    
    const sendMessageMutation = useSendMessage();
    const markAsReadMutation = useMarkAsRead();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        
        // Verifica se eu recebi mensagens e elas não estão lidas ainda, avisa o servidor que eu vi!
        if (messages.length > 0 && conversationId && user) {
            const hasUnread = messages.some(m => m.sender_id !== user.id && m.read_at === null);
            if (hasUnread) {
                markAsReadMutation.mutate({ conversationId, userId: user.id });
            }
        }
    }, [messages, conversationId, user, markAsReadMutation]);

    const handleSend = (e) => {
        e.preventDefault();
        
        // Tratar futuro Memorando
        if (contact.isBroadcast) {
            alert("A funcionalidade de Memorandos Múltiplos está na próxima fase!");
            return;
        }

        if (!newMessage.trim() || !conversationId) return;
        
        const texto = newMessage.trim();
        setNewMessage(''); // Limpa o input otimisticamente
        
        sendMessageMutation.mutate({
            conversationId: conversationId,
            senderId: user.id,
            conteudo: texto
        }, {
            onError: (err) => {
                const det = err?.message || err?.details || String(err);
                alert("Falha do Servidor: " + det);
                setNewMessage(texto); // Traz a msg de volta pro input em caso de erro
            }
        });
    };

    if (loadingConv || loadingMsgs) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">Validando chaves criptográficas da sala...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden h-full">
            {/* Mensagens Historico */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        Nenhuma mensagem trocada ainda. Mande o primeiro oi!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                <div 
                                    className={`px-4 py-2 max-w-[85%] rounded-2xl shadow-sm text-[14px] ${
                                        isMine 
                                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                                    }`}
                                >
                                    {msg.conteudo}
                                </div>
                                <span className="text-[10.5px] text-gray-400 mt-1 px-1 font-medium tracking-wide flex items-center justify-end gap-1">
                                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    {/* Icone do Whatsapp (Status de Entrega e Leitura) */}
                                    {isMine && (
                                        <FontAwesomeIcon 
                                            icon={faCheckDouble} 
                                            className={msg.read_at ? "text-blue-500 text-[11px]" : "text-gray-400 text-[11px]"} 
                                        />
                                    )}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input de Envio estilo Elegante */}
            <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                <form onSubmit={handleSend} className="flex items-end gap-2 bg-gray-100 rounded-2xl p-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-transparent focus-within:border-blue-300">
                    <textarea 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={contact.isBroadcast ? "Em breve..." : "Digite sua mensagem..."}
                        disabled={contact.isBroadcast || !conversationId}
                        className="flex-1 max-h-32 min-h-[38px] bg-transparent resize-none outline-none text-[15px] px-3 py-2 text-gray-800 placeholder-gray-400 disabled:opacity-50"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <button 
                        type="submit"
                        disabled={!newMessage.trim() || contact.isBroadcast}
                        className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <FontAwesomeIcon icon={faPaperPlane} className="text-[14px] ml-[-2px]" />
                    </button>
                </form>
            </div>
        </div>
    );
}
