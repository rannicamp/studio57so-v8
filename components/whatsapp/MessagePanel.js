'use client'

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching'; 
import { sendWhatsAppText } from '@/utils/whatsapp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSmile, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MessagePanel({ contact }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Busca mensagens (Agora usando ID e Telefone)
    useEffect(() => {
        if ((!contact?.contato_id && !contact?.phone_number) || !organizacaoId) return;

        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const data = await getMessages(
                    supabase, 
                    organizacaoId, 
                    contact.contato_id, 
                    contact.phone_number
                );
                setMessages(data || []);
            } catch (error) {
                console.error("Erro ao carregar mensagens:", error);
                toast.error("Erro ao carregar histórico.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();

        // 2. Realtime: Escuta novas mensagens
        const channels = [];

        if (contact.contato_id) {
            const channelId = supabase
                .channel(`chat:id:${contact.contato_id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${contact.contato_id}`
                }, (payload) => {
                    setMessages((current) => [...current, payload.new]);
                })
                .subscribe();
            channels.push(channelId);
        }

        if (contact.phone_number) {
             const channelPhone = supabase
                .channel(`chat:phone:${contact.phone_number}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: `sender_id=eq.${contact.phone_number}`
                }, (payload) => {
                    setMessages((current) => {
                        if (current.some(m => m.id === payload.new.id)) return current;
                        return [...current, payload.new];
                    });
                })
                .subscribe();
            channels.push(channelPhone);
        }

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [contact?.contato_id, contact?.phone_number, organizacaoId, supabase]);

    // Scroll para o fim
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !contact?.phone_number) return;

        setIsSending(true);
        try {
            const result = await sendWhatsAppText(contact.phone_number, newMessage);
            
            if (result.success) {
                setNewMessage('');
            } else {
                toast.error('Erro ao enviar mensagem.');
            }
        } catch (error) {
            console.error('Erro no envio:', error);
            toast.error('Falha no envio.');
        } finally {
            setIsSending(false);
        }
    };

    if (!contact) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
                <div className="w-24 h-24 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
                    <FontAwesomeIcon icon={faSmile} size="3x" />
                </div>
                <p>Selecione uma conversa para começar</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#efeae2]">
            {/* REMOVIDO O HEADER REDUNDANTE DAQUI 
               (O page.js já exibe o nome e a foto no topo)
            */}

            {/* Área de Mensagens */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="text-center text-gray-500 mt-10">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-10 p-4 bg-white/50 rounded-lg shadow-sm mx-auto max-w-md">
                        <p>Nenhuma mensagem encontrada.</p>
                        <p className="text-xs mt-1">Envie a primeira mensagem para iniciar.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.direction === 'outbound';
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${
                                    isMe ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'
                                }`}>
                                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                    <span className="text-[10px] text-gray-500 block text-right mt-1">
                                        {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : '...'}
                                        {isMe && (
                                            <span className="ml-1">
                                                {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input de Envio */}
            <div className="p-3 bg-[#f0f2f5] border-t">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    <button type="button" className="p-2 text-gray-500 hover:text-gray-700">
                        <FontAwesomeIcon icon={faPaperclip} size="lg" />
                    </button>
                    <div className="flex-grow bg-white rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Digite uma mensagem"
                            className="w-full p-3 max-h-32 bg-transparent border-none focus:ring-0 resize-none text-sm"
                            rows={1}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isSending || !newMessage.trim()}
                        className={`p-3 rounded-full text-white transition-colors ${
                            isSending || !newMessage.trim() 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-[#00a884] hover:bg-[#008f6f]'
                        }`}
                    >
                        <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                </form>
            </div>
        </div>
    );
}