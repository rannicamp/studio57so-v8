//components\WhatsAppChatManager.js

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // 1. Importamos as novas ferramentas
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faSpinner, faUserCircle, faSearch, faAddressBook,
    faPaperclip, faFileAlt, faMicrophone, faTimes, faFileImage,
    faTrash, faCheck, faCheckDouble, faUserPlus, faFileSignature
} from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppMedia, sendWhatsAppText, sendWhatsAppTemplate } from '../utils/whatsapp';
import TemplateMessageModal from './whatsapp/TemplateMessageModal';

// Componente para exibir as bolhas de mensagem (sem alterações)
const MessageBubble = ({ message }) => {
    // ... (nenhuma alteração aqui, o código é o mesmo)
    const isSentByUser = message.direction === 'outbound';
    const bubbleClasses = isSentByUser ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg' : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';
    
    const renderContent = () => {
        const payload = typeof message.raw_payload === 'string' ? JSON.parse(message.raw_payload) : message.raw_payload;
        const type = payload?.type;

        switch (type) {
            case 'document': 
                return (
                    <a href={payload.document?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                        <FontAwesomeIcon icon={faFileAlt} className="text-xl" />
                        <span>{payload.document?.caption || payload.document?.filename || 'Documento'}</span>
                    </a>
                );
            case 'image': 
                return (
                    <a href={payload.image?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2">
                        <img src={payload.image?.link} alt={payload.image?.caption || 'Imagem'} className="max-w-xs rounded-md" />
                        {payload.image?.caption && <span className="text-sm">{payload.image.caption}</span>}
                    </a>
                );
            case 'audio': 
                return (
                    <audio controls src={payload.audio?.link} className="w-64">
                        Seu navegador não suporta o elemento de áudio.
                    </audio>
                );
            case 'template':
                const bodyComponent = payload.template?.components?.find(c => c.type === 'body');
                const text = bodyComponent?.parameters?.map(p => p.text).join(', ') || payload.template?.name || 'Template';
                return <p className="text-sm break-words"><em>Modelo:</em> {text}</p>;
            case 'text': 
            default: 
                return <p className="text-sm break-words">{message.content}</p>;
        }
    }

    const renderStatusIcons = () => {
        if (!isSentByUser) return null;
        const baseClasses = "text-xs ml-1";
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

// 2. A lógica de buscar mensagens foi isolada em sua própria função
const fetchMessagesForContact = async (supabase, contactId) => {
    if (!contactId) return [];
    const { data, error } = await supabase.from('whatsapp_messages')
        .select('*')
        .eq('contato_id', contactId)
        .order('sent_at', { ascending: true });
    if (error) {
        toast.error(`Erro ao buscar mensagens: ${error.message}`);
        throw error;
    }
    return data || [];
};


export default function WhatsAppChatManager({ contatos, onMarkAsRead, onNewMessageSent, onContactSelected }) {
    const supabase = createClient();
    const queryClient = useQueryClient(); // Cliente para interagir com o cache
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [selectedContact, setSelectedContact] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const chatEndRef = useRef(null);
    // ... (outros estados mantidos)
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef(null);
    const [attachment, setAttachment] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null); 
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    // 3. Usamos useQuery para buscar e gerenciar as mensagens do contato selecionado
    const { data: messages = [], isLoading: loadingMessages } = useQuery({
        queryKey: ['whatsappMessages', selectedContact?.id],
        queryFn: () => fetchMessagesForContact(supabase, selectedContact.id),
        enabled: !!selectedContact, // SÓ EXECUTA A BUSCA QUANDO HÁ UM CONTATO SELECIONADO
        staleTime: 1000 * 60, // 1 minuto de cache
    });

    const handleSendTemplate = async (templateName, variables) => {
        // ... (código mantido, sem alterações)
        if (!selectedContact) throw new Error("Nenhum contato selecionado.");
        const phoneNumber = selectedContact.telefones?.[0]?.telefone;
        if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");

        const components = [{
            type: "body",
            parameters: variables.map(v => ({ type: "text", text: v }))
        }];
        
        await sendWhatsAppTemplate(phoneNumber, templateName, 'pt_BR', components);
        onNewMessageSent();
    };

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contatos;
        return contatos.filter(contact => { 
            const name = (contact.nome || contact.razao_social || '').toLowerCase(); 
            const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase(); 
            return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase()); 
        });
    }, [contatos, searchTerm]);

    useEffect(() => {
        if (messages.length > 0) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // 4. A função de selecionar contato agora é MUITO mais simples
    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact); 
        onContactSelected(contact.id);
        
        // Limpa os campos de nova mensagem
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);
        if (isRecording) { 
            mediaRecorderRef.current?.stop(); 
            setIsRecording(false); 
        }

        // Marca como lido, se necessário
        if (contact.unread_count > 0) {
            await onMarkAsRead(contact.id);
        }
    }, [isRecording, onMarkAsRead, onContactSelected]);

    // 5. O listener de tempo real agora atualiza o cache do useQuery
    useEffect(() => {
        if (!selectedContact) return;

        const channel = supabase
            .channel(`whatsapp_messages_for_${selectedContact.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `contato_id=eq.${selectedContact.id}` },
                (payload) => {
                    console.log('Nova mensagem recebida em tempo real:', payload);
                    // Invalida a query, fazendo o useQuery buscar os dados mais recentes automaticamente
                    queryClient.invalidateQueries({ queryKey: ['whatsappMessages', selectedContact.id] });
                    onNewMessageSent(); // Avisa o componente pai para reordenar a lista
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedContact, supabase, queryClient, onNewMessageSent]);


    const handleSendMessage = async () => {
        // ... (código mantido, apenas removi o 'organizacaoId' que não é necessário na função de envio)
        if (!selectedContact || (!newMessage.trim() && !attachment && !audioBlob)) return;
        const textToSend = newMessage; 
        const attachmentToSend = attachment; 
        const audioToSend = audioBlob;
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);

        const promise = async () => {
            setIsSending(true);
            const phoneNumber = selectedContact.telefones?.[0]?.telefone;
            if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");
            
            let fileToSend = attachmentToSend;
            if (audioToSend) {
                fileToSend = new File([audioToSend], "audio_gravado.mp3", { type: 'audio/mpeg' }); 
            }
            
            if (fileToSend) {
                const mediaType = getMediaType(fileToSend);
                const sanitizedFileName = fileToSend.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `${selectedContact.id}/${Date.now()}_${sanitizedFileName}`;
                
                const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, fileToSend);
                if (uploadError) throw uploadError;
                
                const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
                if (!urlData?.publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");
                
                await sendWhatsAppMedia(phoneNumber, mediaType, urlData.publicUrl, textToSend, mediaType === 'document' ? fileToSend.name : undefined);
            } 
            else if (textToSend) { 
                await sendWhatsAppText(phoneNumber, textToSend); 
            }
            onNewMessageSent();
        };

        toast.promise(promise(), {
            loading: 'Enviando mensagem...',
            success: 'Mensagem enviada com sucesso!',
            error: (err) => {
                setNewMessage(textToSend); 
                setAttachment(attachmentToSend); 
                setAudioBlob(audioToSend);
                if (audioToSend && audioUrl) setAudioUrl(URL.createObjectURL(audioToSend));
                return `Erro ao enviar: ${err.message}`;
            },
            finally: () => setIsSending(false),
        });
    };
    
    // Demais funções (gravação de áudio, renderização de avatar, etc.) mantidas sem alteração
    const handleFileSelected = (event) => { const file = event.target.files[0]; if (file) { setAttachment(file); } if (fileInputRef.current) { fileInputRef.current.value = ""; } };
    const getMediaType = (file) => { if (file.type.startsWith('image/')) return 'image'; if (file.type.startsWith('video/')) return 'video'; if (file.type.startsWith('audio/')) return 'audio'; return 'document'; };
    const convertToMp3 = async (audioBlob) => { if (!window.lamejs) throw new Error("Biblioteca de conversão de áudio não carregou."); const audioContext = new (window.AudioContext || window.webkitAudioContext)(); const arrayBuffer = await audioBlob.arrayBuffer(); try { const audioBuffer = await audioContext.decodeAudioData(arrayBuffer); let pcmData; if (audioBuffer.numberOfChannels === 2) { const left = audioBuffer.getChannelData(0); const right = audioBuffer.getChannelData(1); pcmData = new Float32Array(left.length); for (let i = 0; i < left.length; i++) pcmData[i] = (left[i] + right[i]) / 2; } else { pcmData = audioBuffer.getChannelData(0); } const samples = new Int16Array(pcmData.length); for (let i = 0; i < pcmData.length; i++) { const s = Math.max(-1, Math.min(1, pcmData[i])); samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; } const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128); const mp3Data = []; const BATCH_SIZE = 1152; for (let i = 0; i < samples.length; i += BATCH_SIZE) { const batch = samples.subarray(i, i + BATCH_SIZE); const mp3buf = mp3Encoder.encodeBuffer(batch); if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf)); } const end = mp3Encoder.flush(); if (end.length > 0) mp3Data.push(new Uint8Array(end)); const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' }); if (mp3Blob.size === 0) throw new Error("A conversão resultou em um arquivo de áudio vazio."); return mp3Blob; } catch(decodeError) { throw new Error(`Falha ao ler o áudio gravado: ${decodeError.message}`); } };
    const handleStartRecording = async () => { setAttachment(null); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const options = { mimeType: 'audio/webm;codecs=opus' }; if (!MediaRecorder.isTypeSupported(options.mimeType)) delete options.mimeType; mediaRecorderRef.current = new MediaRecorder(stream, options); audioChunksRef.current = []; mediaRecorderRef.current.ondataavailable = event => { audioChunksRef.current.push(event.data); }; mediaRecorderRef.current.onstop = async () => { stream.getTracks().forEach(track => track.stop()); const recordedBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType }); try { const mp3Blob = await convertToMp3(recordedBlob); const audioUrl = URL.createObjectURL(mp3Blob); setAudioBlob(mp3Blob); setAudioUrl(audioUrl); } catch (error) { toast.error(`Erro ao processar o áudio: ${error.message}`); handleCancelRecording(); } }; mediaRecorderRef.current.start(); setIsRecording(true); } catch (err) { toast.error(`Não foi possível acessar o microfone: ${err.message}`); } };
    const handleStopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
    const handleCancelRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.stream) { mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); } mediaRecorderRef.current?.stop(); setIsRecording(false); setAudioBlob(null); setAudioUrl(null); };
    const renderContactAvatar = (contact) => { const name = contact?.nome || contact?.razao_social; const bgColor = contact?.is_awaiting_name_response ? 'bg-yellow-400' : 'bg-blue-200'; const textColor = contact?.is_awaiting_name_response ? 'text-yellow-900' : 'text-blue-800'; if (name && name.trim().length > 0) { const firstLetter = name.trim().charAt(0).toUpperCase(); return <div className={`w-10 h-10 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-lg font-bold`}>{firstLetter}</div>; } return <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />; };

    return (
        <>
            <TemplateMessageModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSendTemplate={handleSendTemplate}
                contactName={selectedContact?.nome || selectedContact?.razao_social || ''}
            />
            <div className="grid grid-cols-[300px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
                {/* Coluna da Lista de Contatos */}
                <div className="flex flex-col border-r overflow-hidden">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                            <FontAwesomeIcon icon={faAddressBook} /> Contatos ({filteredContacts.length})
                        </h2>
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Pesquisar..." className="w-full p-2 pl-9 border rounded-md text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <ul className="overflow-y-auto flex-1">
                        {filteredContacts.length === 0 ? ( <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato encontrado.</p> ) : (
                            filteredContacts.map(contact => (
                                <li key={contact.id} onClick={() => handleSelectContact(contact)} className={`p-3 cursor-pointer hover:bg-gray-100 flex justify-between items-start ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''} ${contact.is_awaiting_name_response ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        {renderContactAvatar(contact)}
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-semibold truncate">
                                                {contact.is_awaiting_name_response ? ( <span className="text-yellow-800 flex items-center gap-1"><FontAwesomeIcon icon={faUserPlus} className="text-sm" /> Novo Contato</span> ) : ( contact.nome || contact.razao_social )}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                                            {contact.last_whatsapp_message_time && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Última: {new Date(contact.last_whatsapp_message_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(contact.last_whatsapp_message_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {contact.unread_count > 0 && (
                                        <div className="ml-2 mt-1"><span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{contact.unread_count}</span></div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Coluna do Chat (Mensagens) */}
                <div className="flex flex-col bg-gray-100 overflow-hidden">
                    {selectedContact ? (
                        <>
                            <div className="p-4 border-b flex items-center gap-3 bg-white">
                                {renderContactAvatar(selectedContact)}
                                <div>
                                    <h3 className="font-bold">
                                        {selectedContact.is_awaiting_name_response ? ( <span className="text-yellow-800 flex items-center gap-1"><FontAwesomeIcon icon={faUserPlus} className="text-lg" /> Novo Contato</span> ) : ( selectedContact.nome || selectedContact.razao_social )}
                                    </h3>
                                    <p className="text-sm text-gray-500">{selectedContact.telefones?.[0]?.telefone || 'Sem telefone'}{selectedContact.is_awaiting_name_response && ( <span className="ml-2 text-yellow-700">(Aguardando nome)</span> )}</p>
                                </div>
                            </div>
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col">
                                {loadingMessages ? ( <div className="m-auto text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div> ) : ( messages.map(msg => <MessageBubble key={msg.id} message={msg} />) )}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 border-t bg-white space-y-2">
                                {/* ... (JSX do rodapé do chat mantido, sem alterações) */}
                                {attachment && ( <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in"> <div className="flex items-center gap-2 text-sm text-blue-800"><FontAwesomeIcon icon={attachment.type.startsWith('image/') ? faFileImage : faFileAlt} /><span className="font-medium truncate">{attachment.name}</span></div> <button onClick={() => setAttachment(null)} className="text-blue-600 hover:text-blue-800"><FontAwesomeIcon icon={faTimes} /></button> </div> )}
                                {audioUrl && ( <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in"> <audio src={audioUrl} controls className="w-full h-10"></audio> <button onClick={handleCancelRecording} className="text-red-500 hover:text-red-700 ml-2 p-1"><FontAwesomeIcon icon={faTrash} /></button> </div> )}
                                <div className="flex items-center gap-3"> {isRecording ? ( <div className="flex-1 flex items-center gap-4 bg-red-100 p-2 rounded-full"> <button onClick={handleStopRecording} className="text-red-600"><FontAwesomeIcon icon={faCheck} className="text-xl" /></button> <div className="w-full text-center text-red-600 font-semibold animate-pulse">Gravando...</div> <button onClick={handleCancelRecording} className="text-gray-600"><FontAwesomeIcon icon={faTrash} className="text-xl" /></button> </div> ) : ( <> <button onClick={() => setIsTemplateModalOpen(true)} title="Enviar Mensagem de Modelo" className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50" disabled={isSending}> <FontAwesomeIcon icon={faFileSignature} className="text-xl"/> </button> <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" /> <button onClick={() => fileInputRef.current.click()} disabled={isSending || audioBlob} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50"> <FontAwesomeIcon icon={faPaperclip} className="text-xl"/> </button> <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }} placeholder={audioBlob ? "Áudio pronto para envio" : "Digite uma mensagem..."} className="flex-1 p-2 border rounded-full" disabled={audioBlob}/> {newMessage.trim() || attachment || audioBlob ? ( <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !attachment && !audioBlob)} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400"> {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />} </button> ) : ( <button onClick={handleStartRecording} disabled={isSending} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50"> <FontAwesomeIcon icon={faMicrophone} className="text-xl"/> </button> )} </> )} </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500"><p>Selecione um contato para ver as mensagens.</p></div>
                    )}
                </div>

                {/* Coluna do Assistente de IA */}
                <div className="p-4 space-y-4 bg-white border-l border-gray-200">
                    <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">Assistente de IA (Desativado)</h3>
                    <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700"><p>O assistente de IA está temporariamente desativado para melhorias. Por favor, entre em contato com o suporte se precisar de ajuda adicional.</p></div>
                </div>
            </div>
        </>
    );
}