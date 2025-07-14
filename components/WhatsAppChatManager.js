"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faSpinner, faUserCircle, faSearch, faAddressBook, faRobot,
    faPaperclip, faFileAlt, faMicrophone, faStopCircle, faPlayCircle, faTimes, faFileImage
} from '@fortawesome/free-solid-svg-icons';

// Subcomponentes (MessageBubble, AIChatAssistant) permanecem os mesmos...
const MessageBubble = ({ message }) => {
    const isSentByUser = message.direction === 'outbound';
    const bubbleClasses = isSentByUser ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg' : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';
    
    const renderContent = () => {
        const type = message.raw_payload?.type;
        switch (type) {
            case 'document':
                 return (<a href={message.raw_payload.document?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    <FontAwesomeIcon icon={faFileAlt} className="text-xl" />
                    <span>{message.raw_payload.document?.filename || message.content || 'Documento'}</span>
                </a>);
            case 'image':
                 return (<a href={message.raw_payload.image?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2">
                    <img src={message.raw_payload.image?.link} alt={message.raw_payload.image?.caption || 'Imagem'} className="max-w-xs rounded-md" />
                    {message.raw_payload.image?.caption && <span className="text-sm">{message.raw_payload.image.caption}</span>}
                </a>);
            case 'audio':
                return (<div className="flex items-center gap-2"><FontAwesomeIcon icon={faPlayCircle} className="text-xl" /><span>Mensagem de voz</span></div>);
            case 'text':
            default:
                return <p className="text-sm break-words">{message.content}</p>;
        }
    }

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            {renderContent()}
            <p className="text-xs mt-1 text-right opacity-70">{new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
    );
};
const AIChatAssistant = ({ selectedContact }) => (
    <div className="p-4 space-y-4 bg-white border-l border-gray-200"><h3 className="text-md font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faRobot} /> Assistente de IA</h3><div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">{selectedContact ? <p>A IA monitorará a conversa com **{selectedContact.nome || selectedContact.razao_social}**.</p> : <p>Selecione um contato para ativar o assistente.</p>}</div></div>
);


export default function WhatsAppChatManager({ contatos }) {
    const supabase = createClient();
    
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayContacts, setDisplayContacts] = useState([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    
    // ***** INÍCIO DA MUDANÇA *****
    const [attachment, setAttachment] = useState(null); // Novo estado para o anexo
    // ***** FIM DA MUDANÇA *****
    
    useEffect(() => {
        // Lógica de ordenação de contatos (sem alteração)
        const organizeAndSortContacts = async () => {
            if (!contatos || contatos.length === 0) { setDisplayContacts([]); setIsLoadingContacts(false); return; }
            setIsLoadingContacts(true);
            const { data: messagesData, error } = await supabase.from('whatsapp_messages').select('contato_id, sent_at').not('contato_id', 'is', null).order('sent_at', { ascending: false });
            if (error) { console.error("ERRO DO SUPABASE ao buscar datas:", error.message); const sortedAlphabetically = [...contatos].sort((a, b) => (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '')); setDisplayContacts(sortedAlphabetically.map(c => ({ ...c, lastMessageDate: null }))); setIsLoadingContacts(false); return; }
            const datesMap = new Map();
            messagesData.forEach(msg => { const contactIdStr = String(msg.contato_id); if (!datesMap.has(contactIdStr)) { datesMap.set(contactIdStr, new Date(msg.sent_at)); } });
            const enrichedContacts = contatos.map(contact => ({ ...contact, lastMessageDate: datesMap.get(String(contact.id)) || null }));
            const sorted = enrichedContacts.sort((a, b) => { const dateA = a.lastMessageDate; const dateB = b.lastMessageDate; if (dateA && dateB) return dateB.getTime() - dateA.getTime(); if (dateA) return -1; if (dateB) return 1; const nameA = a.nome || a.razao_social || ''; const nameB = b.nome || b.razao_social || ''; return nameA.localeCompare(nameB); });
            setDisplayContacts(sorted);
            setIsLoadingContacts(false);
        };
        organizeAndSortContacts();
    }, [contatos, supabase, refreshTrigger]);

    const filteredContacts = useMemo(() => {
        if (!searchTerm) { return displayContacts; }
        return displayContacts.filter(contact => { const name = (contact.nome || contact.razao_social || '').toLowerCase(); const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase(); return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase()); });
    }, [displayContacts, searchTerm]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact); setLoadingMessages(true); setMessages([]); setNewMessage(''); setAttachment(null);
        const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contato_id', contact.id).order('sent_at', { ascending: true });
        if (error) { console.error("Erro ao buscar mensagens do contato:", error); } else { setMessages(data || []); }
        setLoadingMessages(false);
    }, [supabase]);
    
    useEffect(() => {
        if (!selectedContact) return;
        const channel = supabase.channel(`realtime_whatsapp_for_${selectedContact.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `contato_id=eq.${selectedContact.id}` }, (payload) => { handleSelectContact(selectedContact); setRefreshTrigger(prev => prev + 1); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedContact, supabase, handleSelectContact]);

    // ***** INÍCIO DAS MUDANÇAS *****
    
    // Agora, esta função apenas prepara o anexo, não o envia.
    const handleFileSelected = (event) => {
        const file = event.target.files[0];
        if (file) {
            setAttachment(file);
        }
        // Limpa o input para permitir selecionar o mesmo arquivo novamente
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const getMediaType = (file) => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'document';
    };

    // Esta é a nova função principal de envio
    const handleSendMessage = async () => {
        if (!selectedContact || (!newMessage.trim() && !attachment)) return;

        setIsSending(true);
        const textToSend = newMessage;
        const attachmentToSend = attachment;
        
        // Limpa os campos da interface imediatamente
        setNewMessage('');
        setAttachment(null);

        try {
            // Se houver um anexo, faz todo o processo dele
            if (attachmentToSend) {
                const mediaType = getMediaType(attachmentToSend);

                const sanitizedFileName = attachmentToSend.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `${selectedContact.id}/${Date.now()}_${sanitizedFileName}`;

                const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, attachmentToSend);
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
                if (!urlData?.publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");

                const saveResponse = await fetch('/api/whatsapp/save-attachment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        p_contato_id: selectedContact.id, p_storage_path: filePath, p_public_url: urlData.publicUrl,
                        p_file_name: attachmentToSend.name, p_file_type: attachmentToSend.type, p_file_size: attachmentToSend.size,
                    })
                });
                if (!saveResponse.ok) {
                    const err = await saveResponse.json();
                    throw new Error(err.error || "Falha ao registrar anexo no servidor.");
                }

                const sendPayload = {
                    to: selectedContact.telefones?.[0]?.telefone,
                    type: mediaType,
                    link: urlData.publicUrl,
                    filename: mediaType === 'document' ? attachmentToSend.name : undefined,
                    caption: textToSend || '' // O texto agora é a legenda!
                };
                await sendMessageAPI(sendPayload);
            } 
            // Se não houver anexo, mas houver texto, envia apenas o texto
            else if (textToSend) {
                const sendPayload = { to: selectedContact.telefones?.[0]?.telefone, type: 'text', text: textToSend };
                await sendMessageAPI(sendPayload);
            }
        } catch (error) {
            console.error("Falha no processo de envio:", error);
            alert(`Erro ao enviar: ${error.message}`);
            // Restaura o que o usuário estava digitando se o envio falhar
            setNewMessage(textToSend);
            setAttachment(attachmentToSend);
        } finally {
            setIsSending(false);
        }
    };

    const sendMessageAPI = async (payload) => {
        const response = await fetch('/api/whatsapp/send', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Erro desconhecido na API de envio do WhatsApp.');
        }
        return response.json();
    };

    // ***** FIM DAS MUDANÇAS *****

    const handleStartRecording = () => setIsRecording(true);
    const handleStopRecording = () => setIsRecording(false);
    
    return (
        <div className="grid grid-cols-[300px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
            <div className="flex flex-col border-r overflow-hidden"><div className="p-4 border-b"><h2 className="text-lg font-bold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faAddressBook} /> Contatos ({filteredContacts.length})</h2><div className="relative"><FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Pesquisar..." className="w-full p-2 pl-9 border rounded-md text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div><ul className="overflow-y-auto flex-1">{isLoadingContacts ? <div className="text-center p-4 flex items-center justify-center gap-2 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div> : filteredContacts.length === 0 ? <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato.</p> : filteredContacts.map(contact => (<li key={contact.id} onClick={() => handleSelectContact(contact)} className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''}`}><p className="font-semibold truncate">{contact.nome || contact.razao_social}</p><p className="text-sm text-gray-500">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>{contact.lastMessageDate && (<p className="text-xs text-gray-400 mt-1">Última: {contact.lastMessageDate.toLocaleDateString('pt-BR')} {contact.lastMessageDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>)}</li>))}</ul></div>
            
            <div className="flex flex-col bg-gray-100 overflow-hidden">{selectedContact ? (<>
                <div className="p-4 border-b flex items-center gap-3 bg-white"><FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" /><div><h3 className="font-bold">{selectedContact.nome || selectedContact.razao_social}</h3><p className="text-sm text-gray-500">{selectedContact.telefones?.[0]?.telefone || 'Sem telefone'}</p></div></div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col">{loadingMessages ? <div className="m-auto text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div> : messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}<div ref={chatEndRef} /></div>
                <div className="p-4 border-t bg-white space-y-2">
                    {/* ÁREA DE PREVIEW DO ANEXO */}
                    {attachment && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                            <div className="flex items-center gap-2 text-sm text-blue-800">
                                <FontAwesomeIcon icon={attachment.type.startsWith('image/') ? faFileImage : faFileAlt} />
                                <span className="font-medium truncate">{attachment.name}</span>
                            </div>
                            <button onClick={() => setAttachment(null)} className="text-blue-600 hover:text-blue-800"><FontAwesomeIcon icon={faTimes} /></button>
                        </div>
                    )}
                    {/* ÁREA DE INPUT PRINCIPAL */}
                    <div className="flex items-center gap-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                        <button onClick={() => fileInputRef.current.click()} disabled={isSending} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50"><FontAwesomeIcon icon={faPaperclip} className="text-xl"/></button>
                        
                        {isRecording ? (<div className="flex-1 flex items-center gap-3"><button onClick={handleStopRecording} className="text-red-500"><FontAwesomeIcon icon={faStopCircle} className="text-2xl" /></button><p className="text-sm text-red-500 font-semibold">Gravando...</p></div>
                        ) : (<>
                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }} placeholder={attachment ? "Adicione uma legenda..." : "Digite uma mensagem..."} className="flex-1 p-2 border rounded-full" />
                            <button onClick={handleStartRecording} disabled={isSending} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50"><FontAwesomeIcon icon={faMicrophone} className="text-xl"/></button>
                            <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !attachment)} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400">
                                {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                            </button>
                        </>)}
                    </div>
                </div>
            </>) : <div className="flex items-center justify-center h-full text-gray-500"><p>Selecione um contato para ver as mensagens.</p></div>}</div>
            
            <AIChatAssistant selectedContact={selectedContact} />
        </div>
    );
}