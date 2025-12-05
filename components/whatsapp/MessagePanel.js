'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPaperPlane, 
    faSpinner, 
    faUserCircle, 
    faPaperclip, 
    faFileLines,
    faMicrophone,
    faStop,
    faVideo,
    faFileAlt,
    faCheck,
    faCheckDouble,
    faPlayCircle
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';
import FilePreviewModal from './FilePreviewModal';
import ChatMediaViewer from './ChatMediaViewer'; // <--- NOVO IMPORT

// Helper para identificar o tipo de arquivo
const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

// Helper para limpar nome de arquivo
const sanitizeFileName = (fileName) => {
    return fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
};

export default function MessagePanel({ contact, onBack }) {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    
    // Estados para Arquivo (Upload)
    const [selectedFile, setSelectedFile] = useState(null);
    const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);

    // Estados para Visualização (Lightbox)
    const [viewerMedia, setViewerMedia] = useState(null); // { url, type, name }
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // Estados para Áudio
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingInterval = useRef(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [recipientPhone, setRecipientPhone] = useState(null);

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Busca Mensagens
    const { data: messages, isLoading } = useQuery({
        queryKey: ['messages', organizacaoId, contact?.contato_id],
        queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
        enabled: !!organizacaoId && !!contact,
        refetchInterval: 5000,
    });

    // Define o telefone de destino
    useEffect(() => {
        if (messages && messages.length > 0) {
            const inboundMsg = messages.find(m => m.direction === 'inbound');
            if (inboundMsg && inboundMsg.sender_id) {
                setRecipientPhone(inboundMsg.sender_id);
                return;
            }
            const outboundMsg = messages.find(m => m.direction === 'outbound');
            if (outboundMsg && outboundMsg.receiver_id) {
                setRecipientPhone(outboundMsg.receiver_id);
            }
        } else if (contact?.phone_number || contact?.telefone) {
            setRecipientPhone(contact.phone_number || contact.telefone);
        }
    }, [messages, contact]);

    // Scroll automático
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    // Realtime do Supabase
    useEffect(() => {
        if (!contact || !organizacaoId) return;
        
        const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'whatsapp_messages', 
                    filter: `organizacao_id=eq.${organizacaoId}` 
                }, 
                (payload) => {
                    if (payload.new.contato_id === contact.contato_id || payload.new.sender_id === recipientPhone || payload.new.receiver_id === recipientPhone) {
                        queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
                    }
                    queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
                }
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [contact, organizacaoId, recipientPhone, supabase, queryClient]);

    const mutationOptions = {
        onError: (error) => toast.error(`Erro: ${error.message}`),
    };

    // 1. Envio de Texto
    const sendMessageMutation = useMutation({
        mutationFn: async (messageContent) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: recipientPhone, 
                    type: 'text', 
                    text: messageContent 
                }),
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao enviar mensagem');
            return data;
        },
        onSuccess: () => {
            setNewMessage('');
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        ...mutationOptions,
    });

    // 2. Envio de Template
    const sendTemplateMutation = useMutation({
        mutationFn: async ({ templateName, language, variables }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            
            const components = variables.length > 0 
                ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }] 
                : [];
            
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: recipientPhone, 
                    type: 'template', 
                    templateName, 
                    languageCode: language, 
                    components 
                }),
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao enviar modelo');
            return data;
        },
        onSuccess: () => {
            setIsTemplateModalOpen(false);
            toast.success("Modelo enviado!");
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        ...mutationOptions,
    });

    // 3. Envio de Anexo
    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file, caption }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            
            const loadingToastId = toast.loading("Enviando mídia...");
            
            try {
                const cleanName = sanitizeFileName(file.name);
                const fileExt = cleanName.split('.').pop();
                const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                
                const date = new Date();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const filePath = `chat/${contact.contato_id}/${year}/${month}/${uniqueName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('whatsapp-media') 
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type
                    });
                    
                if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
                
                const { data: urlData } = supabase.storage
                    .from('whatsapp-media')
                    .getPublicUrl(filePath);
                    
                if (!urlData || !urlData.publicUrl) throw new Error("Erro ao gerar URL.");
                const publicUrl = urlData.publicUrl;

                const attachmentType = getAttachmentType(file.type);
                
                const response = await fetch('/api/whatsapp/send', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        to: recipientPhone, 
                        type: attachmentType, 
                        link: publicUrl, 
                        filename: cleanName, 
                        caption: caption || ''
                    }),
                });
                
                const apiResult = await response.json();
                if (!response.ok) throw new Error(apiResult.error || 'A Meta recusou o arquivo.');

                await fetch('/api/whatsapp/save-attachment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contato_id: contact.contato_id,
                        message_id: apiResult.data?.messages?.[0]?.id,
                        storage_path: filePath,
                        public_url: publicUrl,
                        file_name: cleanName,
                        file_type: file.type,
                        file_size: file.size,
                        organizacao_id: organizacaoId
                    })
                });

                toast.success("Mídia enviada!", { id: loadingToastId });
                return apiResult;

            } catch (err) {
                toast.error(`Erro envio: ${err.message}`, { id: loadingToastId });
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        }
    });

    // --- HANDLERS ---

    const handleSendMessage = (e) => { 
        e.preventDefault(); 
        if (newMessage.trim()) { sendMessageMutation.mutate(newMessage); } 
    };
    
    const handleFileSelect = (e) => { 
        const file = e.target.files[0]; 
        if (file) { 
            if (file.size > 16 * 1024 * 1024) {
                toast.error("Arquivo muito grande (Max 16MB).");
                return;
            }
            setSelectedFile(file);
            setIsFilePreviewOpen(true);
        } 
        e.target.value = null; 
    };
    
    const handleConfirmSendFile = (file, caption) => {
        sendAttachmentMutation.mutate({ file, caption });
    };

    const handleSendTemplate = (templateName, language, variables) => { 
        sendTemplateMutation.mutate({ templateName, language, variables }); 
    };

    // Abre o visualizador (Lightbox)
    const handleOpenViewer = (url, type, name) => {
        setViewerMedia({ url, type, name });
        setIsViewerOpen(true);
    };

    // --- MIC LOGIC ---
    const handleMicClick = async () => {
        if (isRecording) {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            setIsRecording(false);
            if (recordingInterval.current) clearInterval(recordingInterval.current);
            setRecordingTime(0);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                let options = {};
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus' };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4' };
                }

                const recorder = new MediaRecorder(stream, options);
                const chunks = [];

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };
                
                recorder.onstop = async () => {
                    const mimeType = chunks[0]?.type || 'audio/webm';
                    const blob = new Blob(chunks, { type: mimeType });
                    const audioFile = new File([blob], `audio_${Date.now()}.webm`, { type: mimeType });
                    
                    sendAttachmentMutation.mutate({ file: audioFile, caption: '' });
                    stream.getTracks().forEach(track => track.stop());
                };

                recorder.start();
                setMediaRecorder(recorder);
                setIsRecording(true);
                
                recordingInterval.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

            } catch (err) {
                console.error("Erro mic:", err);
                toast.error("Não foi possível acessar o microfone.");
            }
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- RENDER ---

    if (!contact) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-[#f0f2f5] text-gray-500 border-l border-gray-300">
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                     <FontAwesomeIcon icon={faUserCircle} size="4x" className="text-gray-300" />
                </div>
                <h2 className="text-2xl font-light text-gray-600">WhatsApp Web</h2>
                <p className="mt-2 text-sm">Selecione uma conversa para começar</p>
            </div>
        );
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full bg-[#efeae2]"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" /></div>;
    }
    
    return (
        <>
            {/* Modais */}
            <TemplateMessageModal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setIsTemplateModalOpen(false)} 
                onSendTemplate={handleSendTemplate} 
                contactName={contact?.nome} 
            />
            
            <FilePreviewModal
                isOpen={isFilePreviewOpen}
                onClose={() => setIsFilePreviewOpen(false)}
                file={selectedFile}
                onSend={handleConfirmSendFile}
            />

            {/* VISUALIZADOR DE MÍDIA (NOVO) */}
            <ChatMediaViewer 
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                mediaUrl={viewerMedia?.url}
                mediaType={viewerMedia?.type}
                fileName={viewerMedia?.name}
            />

            <div className="flex flex-col h-full bg-[#efeae2] relative">
                
                {/* CABEÇALHO */}
                <div className="bg-[#f0f2f5] px-4 py-3 border-b border-gray-300 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button onClick={onBack} className="md:hidden text-gray-600">
                                <i className="fas fa-arrow-left"></i> Voltar
                            </button>
                        )}
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                             <FontAwesomeIcon icon={faUserCircle} className="text-white text-2xl"/>
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-800 leading-tight">{contact.nome}</h3>
                            <p className="text-xs text-gray-500">{recipientPhone || "Sem número"}</p>
                        </div>
                    </div>
                </div>

                {/* ÁREA DE MENSAGENS */}
                <div 
                    className="flex-grow p-4 overflow-y-auto min-h-0 space-y-2 custom-scrollbar"
                    style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}
                >
                    {messages?.map(msg => {
                        const isMe = msg.direction === 'outbound';
                        
                        let payload = {};
                        try {
                            payload = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload;
                        } catch (e) { payload = {}; }
                        
                        const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                        
                        const isImage = payload?.type === 'image' || payload?.image;
                        const isAudio = payload?.type === 'audio' || payload?.audio;
                        const isVideo = payload?.type === 'video' || payload?.video;
                        const isDocument = payload?.type === 'document' || payload?.document;

                        // Status Icon
                        let StatusIcon = null;
                        if (isMe) {
                            if (msg.status === 'read') StatusIcon = <FontAwesomeIcon icon={faCheckDouble} className="text-[#53bdeb]" />;
                            else if (msg.status === 'delivered') StatusIcon = <FontAwesomeIcon icon={faCheckDouble} className="text-gray-500" />;
                            else StatusIcon = <FontAwesomeIcon icon={faCheck} className="text-gray-500" />;
                        }

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                                <div className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    
                                    <div className="p-1">
                                        {/* Imagem (Interativa) */}
                                        {isImage && mediaUrl && (
                                            <div 
                                                className="rounded overflow-hidden mb-1 cursor-pointer bg-[#cfd4d2] relative group" 
                                                onClick={() => handleOpenViewer(mediaUrl, 'image', 'Imagem')}
                                            >
                                                <img src={mediaUrl} alt="Mídia" className="w-full h-auto max-h-80 object-cover" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    {/* Hover Effect */}
                                                </div>
                                            </div>
                                        )}

                                        {/* Vídeo (Interativo) */}
                                        {isVideo && mediaUrl && (
                                            <div 
                                                className="rounded overflow-hidden mb-1 bg-black relative cursor-pointer group flex items-center justify-center min-h-[150px]"
                                                onClick={() => handleOpenViewer(mediaUrl, 'video', 'Vídeo')}
                                            >
                                                <video src={mediaUrl} className="w-full max-h-80 opacity-80" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
                                                        <FontAwesomeIcon icon={faPlayCircle} size="2x" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Áudio */}
                                        {isAudio && mediaUrl && (
                                            <div className="flex items-center gap-2 p-2 min-w-[240px]">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                    <FontAwesomeIcon icon={faMicrophone} />
                                                </div>
                                                <audio controls src={mediaUrl} className="h-8 w-full max-w-[200px]" />
                                            </div>
                                        )}

                                        {/* Documento */}
                                        {isDocument && (
                                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors cursor-pointer mb-1 no-underline">
                                                <FontAwesomeIcon icon={faFileAlt} className="text-[#e55050] text-2xl" />
                                                <div className="overflow-hidden">
                                                    <p className="font-medium text-gray-700 truncate">{payload?.document?.filename || "Documento"}</p>
                                                    <p className="text-xs text-gray-500 uppercase">{payload?.document?.filename?.split('.').pop() || 'FILE'}</p>
                                                </div>
                                            </a>
                                        )}

                                        {/* Texto / Legenda */}
                                        {msg.content && (msg.content !== 'Imagem' && msg.content !== 'Áudio' && msg.content !== 'Documento' && msg.content !== 'Vídeo') && (
                                            <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed">
                                                {msg.content}
                                            </p>
                                        )}
                                    </div>

                                    {/* Hora e Status */}
                                    <div className="flex justify-end items-center gap-1 px-2 pb-1 mt-[-4px]">
                                        <span className="text-[10px] text-gray-500 min-w-fit">
                                            {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}
                                        </span>
                                        {StatusIcon && <span className="text-[10px]">{StatusIcon}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* ÁREA DE INPUT */}
                <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-2 z-20">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current.click()} className="text-gray-500 hover:text-gray-700 p-2" disabled={sendAttachmentMutation.isPending}>
                        <FontAwesomeIcon icon={faPaperclip} size="lg" />
                    </button>
                    {!isRecording && (
                        <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="text-gray-500 hover:text-gray-700 p-2">
                            <FontAwesomeIcon icon={faFileLines} size="lg" />
                        </button>
                    )}
                    <div className="flex-grow bg-white rounded-lg border border-white flex items-center py-2 px-4 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
                        {isRecording ? (
                            <div className="flex-grow flex items-center justify-between text-red-500 font-medium animate-pulse">
                                <span><FontAwesomeIcon icon={faMicrophone} className="mr-2" /> Gravando... {formatTime(recordingTime)}</span>
                            </div>
                        ) : (
                            <textarea 
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)} 
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                placeholder="Digite uma mensagem" 
                                className="w-full bg-transparent border-none focus:ring-0 resize-none text-gray-700 max-h-24 custom-scrollbar p-0 placeholder-gray-400"
                                rows={1}
                                style={{ minHeight: '24px' }}
                            />
                        )}
                    </div>
                    {newMessage.trim() ? (
                        <button onClick={handleSendMessage} disabled={sendMessageMutation.isPending} className="text-[#00a884] hover:text-[#008f6f] p-2">
                            {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin size="lg"/> : <FontAwesomeIcon icon={faPaperPlane} size="lg" />}
                        </button>
                    ) : (
                        <button type="button" onClick={handleMicClick} className={`p-2 ${isRecording ? 'text-red-500 hover:text-red-600 scale-110' : 'text-gray-500 hover:text-gray-700'}`}>
                            <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} size="lg" />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}