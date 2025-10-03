"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faSpinner, faUserCircle, faSearch, faAddressBook,
    faPaperclip, faFileAlt, faMicrophone, faTimes, faFileImage,
    faTrash, faCheck, faCheckDouble, faUserPlus, faFileSignature, faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppMedia, sendWhatsAppText, sendWhatsAppTemplate } from '../../utils/whatsapp';
import TemplateMessageModal from './TemplateMessageModal';

// --- SUB-COMPONENTES PARA ORGANIZAÇÃO ---

const MessageBubble = ({ message }) => {
    const isSentByUser = message.direction === 'outbound';
    const bubbleClasses = isSentByUser ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg' : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';

    const renderContent = () => {
        const payload = typeof message.raw_payload === 'string' ? JSON.parse(message.raw_payload) : message.raw_payload;
        switch (payload?.type) {
            case 'document': return <a href={payload.document?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline"><FontAwesomeIcon icon={faFileAlt} /><span>{payload.document?.caption || payload.document?.filename || 'Documento'}</span></a>;
            case 'image': return <a href={payload.image?.link || '#'} target="_blank" rel="noopener noreferrer"><img src={payload.image?.link} alt={payload.image?.caption || 'Imagem'} className="max-w-xs rounded-md" />{payload.image?.caption && <span className="text-sm mt-1">{payload.image.caption}</span>}</a>;
            case 'audio': return <audio controls src={payload.audio?.link} className="w-64" />;
            case 'template': return <p className="text-sm break-words"><em>Modelo:</em> {payload.template?.components?.find(c => c.type === 'body')?.parameters?.map(p => p.text).join(', ') || payload.template?.name}</p>;
            default: return <p className="text-sm break-words">{message.content}</p>;
        }
    };

    const renderStatusIcons = () => {
        if (!isSentByUser) return null;
        const baseClasses = "text-xs ml-1.5";
        switch (message.status) {
            case 'sent': return <FontAwesomeIcon icon={faCheck} className={`${baseClasses} text-gray-400`} />;
            case 'delivered': return <FontAwesomeIcon icon={faCheckDouble} className={`${baseClasses} text-gray-400`} />;
            case 'read': return <FontAwesomeIcon icon={faCheckDouble} className={`${baseClasses} text-blue-300`} />;
            default: return null;
        }
    };

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            {renderContent()}
            <p className="text-xs mt-1 text-right opacity-70 flex items-center justify-end">
                {new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {renderStatusIcons()}
            </p>
        </div>
    );
};

const ContactAvatar = ({ contact }) => {
    const name = contact?.nome || contact?.razao_social;
    const bgColor = contact?.is_awaiting_name_response ? 'bg-yellow-400' : 'bg-blue-200';
    const textColor = contact?.is_awaiting_name_response ? 'text-yellow-900' : 'text-blue-800';
    if (name && name.trim().length > 0) {
        const firstLetter = name.trim().charAt(0).toUpperCase();
        return <div className={`w-10 h-10 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-lg font-bold flex-shrink-0`}>{firstLetter}</div>;
    }
    return <FontAwesomeIcon icon={faUserCircle} className="text-4xl text-gray-400" />;
};


// --- LÓGICA PRINCIPAL DO COMPONENTE ---

// ***** ESTA É A FUNÇÃO CORRIGIDA *****
const fetchMessagesForContact = async (supabase, contact) => {
    if (!contact || !contact.telefones || contact.telefones.length === 0) {
        return [];
    }
    
    // Pega o número de telefone do contato (sem o '+' e '55')
    const contactPhoneNumber = contact.telefones[0].telefone.replace(/\D/g, '');
    
    // Busca todas as mensagens onde o número do contato aparece como remetente OU destinatário.
    // O ideal é que o número do seu whatsapp business esteja em uma variável de ambiente,
    // mas por simplicidade vamos buscar em ambas as direções.
    const { data, error } = await supabase.from('whatsapp_messages')
        .select('*')
        .or(`sender_id.like.%${contactPhoneNumber},receiver_id.like.%${contactPhoneNumber}`)
        .order('sent_at', { ascending: true });

    if (error) {
        toast.error(`Erro ao buscar mensagens: ${error.message}`);
        throw error;
    }
    return data || [];
};

export default function WhatsAppChatManager({ contatos, selectedContact, onSelectContact, onBackToList }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const chatEndRef = useRef(null);

    const { data: messages = [], isLoading: loadingMessages } = useQuery({
        // A chave da query agora usa o ID do contato para ser única
        queryKey: ['whatsappMessages', selectedContact?.id], 
        // A função de busca agora recebe o objeto 'selectedContact' inteiro
        queryFn: () => fetchMessagesForContact(supabase, selectedContact),
        // A busca só é ativada se 'selectedContact' existir
        enabled: !!selectedContact,
        staleTime: 1000 * 30,
    });
    
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!selectedContact) return;
        const channel = supabase
            .channel(`whatsapp_messages_for_${selectedContact.telefones[0]?.telefone}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['whatsappMessages', selectedContact.id] });
                }
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedContact, supabase, queryClient]);

    const handleSelectContact = useCallback(async (contact) => {
        onSelectContact(contact);
        setNewMessage('');
        
        if (contact.unread_count > 0) {
            queryClient.setQueryData(['whatsappContacts'], (oldData) =>
                oldData.map(c => c.id === contact.id ? { ...c, unread_count: 0 } : c)
            );
            await supabase.from('whatsapp_messages').update({ is_read: true }).eq('contato_id', contact.id).eq('is_read', false);
        }
    }, [onSelectContact, supabase, queryClient]);

    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;
        const textToSend = newMessage;
        setNewMessage('');

        const promise = async () => {
            setIsSending(true);
            const phoneNumber = selectedContact.telefones?.[0]?.telefone;
            if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");
            await sendWhatsAppText(phoneNumber, textToSend);
            queryClient.invalidateQueries({ queryKey: ['whatsappMessages', selectedContact.id] });
            queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
        };

        toast.promise(promise(), {
            loading: 'Enviando...',
            success: 'Mensagem enviada!',
            error: (err) => {
                setNewMessage(textToSend);
                return `Erro ao enviar: ${err.message}`;
            },
            finally: () => setIsSending(false),
        });
    };
    
    const handleSendTemplate = async (templateName, variables) => {
        if (!selectedContact) return;
        setIsTemplateModalOpen(false);
        const promise = async () => {
             const phoneNumber = selectedContact.telefones?.[0]?.telefone;
             if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");
             const components = [{
                 type: "body",
                 parameters: variables.map(v => ({ type: "text", text: v }))
             }];
             await sendWhatsAppTemplate(phoneNumber, templateName, 'pt_BR', components);
             queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
        };
        toast.promise(promise(), {
            loading: 'Enviando modelo...',
            success: 'Modelo enviado com sucesso!',
            error: (err) => `Erro: ${err.message}`,
        });
    };

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contatos;
        const lowercasedFilter = searchTerm.toLowerCase();
        return contatos.filter(contact =>
            (contact.nome || contact.razao_social || '').toLowerCase().includes(lowercasedFilter) ||
            (contact.telefones?.[0]?.telefone || '').includes(lowercasedFilter)
        );
    }, [contatos, searchTerm]);

    return (
        <>
            <TemplateMessageModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSendTemplate={handleSendTemplate}
                contactName={selectedContact?.nome || selectedContact?.razao_social || ''}
            />
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] h-[calc(100vh-125px)] bg-white rounded-lg shadow-xl border">
                
                <div className={`flex flex-col border-r overflow-hidden ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Pesquisar..." className="w-full p-2 pl-9 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <ul className="overflow-y-auto flex-1">
                        {filteredContacts.length === 0 ? (
                            <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato encontrado.</p>
                        ) : (
                            filteredContacts.map(contact => (
                                <li key={contact.id} onClick={() => handleSelectContact(contact)} className={`p-3 cursor-pointer hover:bg-gray-100 flex justify-between items-center ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''} ${contact.is_awaiting_name_response ? 'bg-yellow-50' : ''}`}>
                                    <div className="flex items-center gap-3 w-full overflow-hidden">
                                        <ContactAvatar contact={contact} />
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-semibold truncate">
                                                {contact.is_awaiting_name_response ? <span className="text-yellow-800 flex items-center gap-1.5"><FontAwesomeIcon icon={faUserPlus} /> Novo Contato</span> : (contact.nome || contact.razao_social)}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                                        </div>
                                    </div>
                                    {contact.unread_count > 0 && (
                                        <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-2 flex-shrink-0">{contact.unread_count}</span>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                <div className={`flex flex-col bg-gray-50 overflow-hidden ${selectedContact ? 'flex' : 'hidden md:flex'}`}>
                    {selectedContact ? (
                        <>
                            <div className="p-3 border-b flex items-center gap-3 bg-white shadow-sm flex-shrink-0">
                                <ContactAvatar contact={selectedContact} />
                                <div>
                                    <h3 className="font-bold">{selectedContact.nome || selectedContact.razao_social || 'Novo Contato'}</h3>
                                    <p className="text-sm text-gray-500">{selectedContact.telefones?.[0]?.telefone}</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                {loadingMessages ? (
                                    <div className="m-auto text-center"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" /> Carregando...</div>
                                ) : messages.length === 0 ? (
                                    <div className="m-auto text-center text-gray-500">Nenhuma mensagem encontrada.</div>
                                ) : (
                                    messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-3 border-t bg-white flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setIsTemplateModalOpen(true)} title="Enviar Modelo" className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                                        <FontAwesomeIcon icon={faFileSignature} className="text-xl"/>
                                    </button>
                                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }} placeholder="Digite uma mensagem..." className="flex-1 p-2 border rounded-full focus:ring-blue-500 focus:border-blue-500" />
                                    <button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400 transition-colors">
                                        {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="hidden md:flex items-center justify-center h-full text-gray-500">
                            <p>Selecione um contato para ver as mensagens.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}