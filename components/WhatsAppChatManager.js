"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faSpinner, faUserCircle, faSearch, faAddressBook,
    faPaperclip, faFileAlt, faMicrophone, faTimes, faFileImage,
    faTrash, faCheck,
    faCheckDouble,
    faUserPlus
} from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppMedia, sendWhatsAppText } from '../utils/whatsapp';

// Componente para exibir as bolhas de mensagem
const MessageBubble = ({ message }) => {
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

export default function WhatsAppChatManager({ contatos, onMarkAsRead, onNewMessageSent, onContactSelected }) {
    const supabase = createClient();
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachment, setAttachment] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null); 
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Filtra contatos com base no termo de busca
    const filteredContacts = useMemo(() => {
        if (!searchTerm) { return contatos; }
        return contatos.filter(contact => { 
            const name = (contact.nome || contact.razao_social || '').toLowerCase(); 
            const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase(); 
            return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase()); 
        });
    }, [contatos, searchTerm]);

    // Efeito para rolar para a última mensagem
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    // Função para selecionar um contato e carregar suas mensagens
    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact); 
        onContactSelected(contact.id); // Informa o componente pai qual contato está aberto
        setLoadingMessages(true); 
        setMessages([]);
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);
        if (isRecording) { 
            mediaRecorderRef.current?.stop(); 
            setIsRecording(false); 
        }

        // Chama a função do pai para marcar mensagens como lidas
        if (contact.unread_count > 0) {
            await onMarkAsRead(contact.id);
        }

        const { data, error } = await supabase.from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id)
            .order('sent_at', { ascending: true });

        if (error) { 
            console.error("Erro ao buscar mensagens:", error); 
        } else { 
            setMessages(data || []); 
        }
        setLoadingMessages(false);
    }, [supabase, isRecording, onMarkAsRead, onContactSelected]);

    // Efeito para o listener de tempo real do Supabase para o contato ABERTO
    useEffect(() => {
        if (!selectedContact) return;

        const channelName = `whatsapp_messages_for_${selectedContact.id}`;
        const channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${selectedContact.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new;
                        setMessages(prevMessages => {
                            if (prevMessages.some(msg => msg.id === newMessage.id)) {
                                return prevMessages;
                            }
                            // Se a mensagem recebida for inbound, marca como lida imediatamente
                            if (newMessage.direction === 'inbound') {
                                supabase.from('whatsapp_messages').update({ is_read: true }).eq('id', newMessage.id).then();
                            }
                            return [...prevMessages, newMessage];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setMessages(prevMessages => 
                            prevMessages.map(msg => 
                                msg.id === payload.old.id ? { ...msg, ...payload.new } : msg
                            )
                        );
                    }
                    // Informa o pai que uma nova mensagem chegou para reordenar a lista
                    onNewMessageSent();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedContact, supabase, setMessages, onNewMessageSent]);

    // Manipulador para seleção de arquivo
    const handleFileSelected = (event) => {
        const file = event.target.files[0];
        if (file) { setAttachment(file); }
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
    };

    const getMediaType = (file) => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'document';
    };

    // Função para converter áudio gravado para MP3 (usando lamejs)
    const convertToMp3 = async (audioBlob) => {
        if (!window.lamejs) throw new Error("Biblioteca de conversão de áudio não carregou.");
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            let pcmData;
            if (audioBuffer.numberOfChannels === 2) {
                const left = audioBuffer.getChannelData(0);
                const right = audioBuffer.getChannelData(1);
                pcmData = new Float32Array(left.length);
                for (let i = 0; i < left.length; i++) pcmData[i] = (left[i] + right[i]) / 2;
            } else {
                pcmData = audioBuffer.getChannelData(0);
            }
            const samples = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
            const mp3Data = [];
            const BATCH_SIZE = 1152;
            for (let i = 0; i < samples.length; i += BATCH_SIZE) {
                const batch = samples.subarray(i, i + BATCH_SIZE);
                const mp3buf = mp3Encoder.encodeBuffer(batch);
                if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            }
            const end = mp3Encoder.flush();
            if (end.length > 0) mp3Data.push(new Uint8Array(end));
            const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
            if (mp3Blob.size === 0) throw new Error("A conversão resultou em um arquivo de áudio vazio.");
            return mp3Blob;
        } catch(decodeError) {
            throw new Error(`Falha ao ler o áudio gravado: ${decodeError.message}`);
        }
    };

    // Gravação de áudio
    const handleStartRecording = async () => {
        setAttachment(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) delete options.mimeType;
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = event => { audioChunksRef.current.push(event.data); };
            mediaRecorderRef.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const recordedBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType });
                try {
                    const mp3Blob = await convertToMp3(recordedBlob);
                    const audioUrl = URL.createObjectURL(mp3Blob);
                    setAudioBlob(mp3Blob);
                    setAudioUrl(audioUrl);
                } catch (error) {
                    alert(`Erro ao processar o áudio: ${error.message}`);
                    handleCancelRecording();
                }
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            alert(`Não foi possível acessar o microfone: ${err.message}`);
        }
    };
    
    const handleStopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
    
    const handleCancelRecording = () => { 
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) { 
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); 
        } 
        mediaRecorderRef.current?.stop(); 
        setIsRecording(false); 
        setAudioBlob(null); 
        setAudioUrl(null); 
    };

    // Lida com o envio de mensagens
    const handleSendMessage = async () => {
        if (!selectedContact || (!newMessage.trim() && !attachment && !audioBlob)) return;
        setIsSending(true);
        const textToSend = newMessage; 
        const attachmentToSend = attachment; 
        const audioToSend = audioBlob;
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);

        try {
            const phoneNumber = selectedContact.telefones?.[0]?.telefone;
            if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");
            
            let fileToSend = attachmentToSend;
            if (audioToSend) {
                if (audioToSend.size === 0) throw new Error("O áudio gravado está vazio.");
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
            onNewMessageSent(); // Informa o pai para reordenar a lista
        } catch (error) {
            console.error("Falha no processo de envio:", error); 
            alert(`Erro ao enviar: ${error.message}`);
            setNewMessage(textToSend); 
            setAttachment(attachmentToSend); 
            setAudioBlob(audioToSend);
            if (audioToSend && audioUrl) setAudioUrl(URL.createObjectURL(audioToSend));
        } finally { 
            setIsSending(false);
        }
    };

    const renderContactAvatar = (contact) => {
        const name = contact?.nome || contact?.razao_social;
        const bgColor = contact?.is_awaiting_name_response ? 'bg-yellow-400' : 'bg-blue-200';
        const textColor = contact?.is_awaiting_name_response ? 'text-yellow-900' : 'text-blue-800';

        if (name && name.trim().length > 0) {
            const firstLetter = name.trim().charAt(0).toUpperCase();
            return (
                <div className={`w-10 h-10 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-lg font-bold`}>
                    {firstLetter}
                </div>
            );
        }
        return <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />;
    };

    return (
        <div className="grid grid-cols-[300px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
            {/* Coluna da Lista de Contatos */}
            <div className="flex flex-col border-r overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faAddressBook} /> Contatos ({filteredContacts.length})
                    </h2>
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full p-2 pl-9 border rounded-md text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <ul className="overflow-y-auto flex-1">
                    {filteredContacts.length === 0 ? (
                        <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato encontrado.</p>
                    ) : (
                        filteredContacts.map(contact => (
                            <li
                                key={contact.id}
                                onClick={() => handleSelectContact(contact)}
                                className={`p-3 cursor-pointer hover:bg-gray-100 flex justify-between items-start ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''} ${contact.is_awaiting_name_response ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}
                            >
                                <div className="flex items-center gap-3 w-full">
                                    {renderContactAvatar(contact)}
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-semibold truncate">
                                            {contact.is_awaiting_name_response ? (
                                                <span className="text-yellow-800 flex items-center gap-1">
                                                    <FontAwesomeIcon icon={faUserPlus} className="text-sm" /> Novo Contato
                                                </span>
                                            ) : (
                                                contact.nome || contact.razao_social
                                            )}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {contact.telefones?.[0]?.telefone || 'Sem telefone'}
                                        </p>
                                        {contact.last_whatsapp_message_time && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Última: {new Date(contact.last_whatsapp_message_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(contact.last_whatsapp_message_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {/* Bolinha de notificação de mensagens não lidas */}
                                {contact.unread_count > 0 && (
                                    <div className="ml-2 mt-1">
                                        <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                            {contact.unread_count}
                                        </span>
                                    </div>
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
                                    {selectedContact.is_awaiting_name_response ? (
                                        <span className="text-yellow-800 flex items-center gap-1">
                                            <FontAwesomeIcon icon={faUserPlus} className="text-lg" /> Novo Contato
                                        </span>
                                    ) : (
                                        selectedContact.nome || selectedContact.razao_social
                                    )}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {selectedContact.telefones?.[0]?.telefone || 'Sem telefone'}
                                    {selectedContact.is_awaiting_name_response && (
                                        <span className="ml-2 text-yellow-700">(Aguardando nome)</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col">
                            {loadingMessages ? (
                                <div className="m-auto text-center">
                                    <FontAwesomeIcon icon={faSpinner} spin /> Carregando...
                                </div>
                            ) : (
                                messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 border-t bg-white space-y-2">
                            {attachment && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center gap-2 text-sm text-blue-800">
                                        <FontAwesomeIcon icon={attachment.type.startsWith('image/') ? faFileImage : faFileAlt} />
                                        <span className="font-medium truncate">{attachment.name}</span>
                                    </div>
                                    <button onClick={() => setAttachment(null)} className="text-blue-600 hover:text-blue-800">
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                            )}
                            {audioUrl && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                                    <audio src={audioUrl} controls className="w-full h-10"></audio>
                                    <button onClick={handleCancelRecording} className="text-red-500 hover:text-red-700 ml-2 p-1">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                {isRecording ? (
                                    <div className="flex-1 flex items-center gap-4 bg-red-100 p-2 rounded-full">
                                        <button onClick={handleStopRecording} className="text-red-600">
                                            <FontAwesomeIcon icon={faCheck} className="text-xl" />
                                        </button>
                                        <div className="w-full text-center text-red-600 font-semibold animate-pulse">
                                            Gravando...
                                        </div>
                                        <button onClick={handleCancelRecording} className="text-gray-600">
                                            <FontAwesomeIcon icon={faTrash} className="text-xl" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                                        <button onClick={() => fileInputRef.current.click()} disabled={isSending || audioBlob} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50">
                                            <FontAwesomeIcon icon={faPaperclip} className="text-xl"/>
                                        </button>
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }}
                                            placeholder={audioBlob ? "Áudio pronto para envio" : "Digite uma mensagem..."}
                                            className="flex-1 p-2 border rounded-full"
                                            disabled={audioBlob}
                                        />
                                        {newMessage.trim() || attachment || audioBlob ? (
                                            <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !attachment && !audioBlob)} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400">
                                                {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                                            </button>
                                        ) : (
                                            <button onClick={handleStartRecording} disabled={isSending} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50">
                                                <FontAwesomeIcon icon={faMicrophone} className="text-xl"/>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Selecione um contato para ver as mensagens.</p>
                    </div>
                )}
            </div>

            {/* Coluna do Assistente de IA (Desativado) */}
            <div className="p-4 space-y-4 bg-white border-l border-gray-200">
                <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                    Assistente de IA (Desativado)
                </h3>
                <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">
                    <p>O assistente de IA está temporariamente desativado para melhorias. Por favor, entre em contato com o suporte se precisar de ajuda adicional.</p>
                </div>
            </div>
        </div>
    );
}
