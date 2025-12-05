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
    faImage,
    faVideo,
    faFileAlt,
    faTrash
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';

// Helper para identificar o tipo de arquivo aceito pelo WhatsApp
const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

// Helper para limpar nome de arquivo (remove acentos e espaços)
const sanitizeFileName = (fileName) => {
    return fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, '_') // Troca espaços por underline
        .replace(/[^a-zA-Z0-9._-]/g, ''); // Remove caracteres especiais
};

export default function MessagePanel({ contact, onBack }) {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    
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

    // Busca Mensagens usando React Query
    const { data: messages, isLoading } = useQuery({
        queryKey: ['messages', organizacaoId, contact?.contato_id],
        queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
        enabled: !!organizacaoId && !!contact,
        refetchInterval: 5000, // Polling de segurança a cada 5s (além do realtime)
    });

    // Define o telefone de destino
    useEffect(() => {
        if (messages && messages.length > 0) {
            // Tenta pegar do histórico primeiro (mais confiável)
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

    // Scroll automático para o fim
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
                    // Se a mensagem for deste contato, atualiza a lista
                    if (payload.new.contato_id === contact.contato_id || payload.new.sender_id === recipientPhone || payload.new.receiver_id === recipientPhone) {
                        queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
                    }
                    // Atualiza a lista lateral de conversas
                    queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
                }
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [contact, organizacaoId, recipientPhone, supabase, queryClient]);

    const mutationOptions = {
        onError: (error) => toast.error(`Erro: ${error.message}`),
        onSettled: () => {}, // Limpeza se necessário
    };

    // 1. Mutação de Envio de Texto
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

    // 2. Mutação de Template
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
                    templateName: templateName, 
                    languageCode: language, 
                    components: components 
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

    // 3. Mutação de Anexo (Arquivo ou Áudio)
    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const loadingToast = toast.loading("Preparando envio da mídia...");
            
            try {
                // A. Sanitizar nome do arquivo
                const cleanName = sanitizeFileName(file.name);
                const fileExt = cleanName.split('.').pop();
                const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                const filePath = `chat/${contact.contato_id}/${uniqueName}`;
                
                // B. Upload para Supabase (Bucket 'whatsapp-media')
                // CORREÇÃO: Usando 'whatsapp-media' com hífen conforme seu bucket real
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('whatsapp-media') 
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type
                    });
                    
                if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
                
                // C. Obter URL Pública
                const { data: urlData } = supabase.storage
                    .from('whatsapp-media')
                    .getPublicUrl(filePath);
                    
                if (!urlData || !urlData.publicUrl) throw new Error("Não foi possível gerar URL pública.");

                const publicUrl = urlData.publicUrl;
                console.log("URL Gerada:", publicUrl);

                // D. Enviar via API do WhatsApp
                const attachmentType = getAttachmentType(file.type);
                
                const response = await fetch('/api/whatsapp/send', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        to: recipientPhone, 
                        type: attachmentType, 
                        link: publicUrl, 
                        filename: cleanName, 
                        caption: attachmentType === 'document' ? cleanName : '' 
                    }),
                });
                
                const apiResult = await response.json();
                if (!response.ok) throw new Error(apiResult.error || 'A Meta recusou o arquivo.');

                // E. Salvar metadados do anexo
                // Importante: A API de send já salva na tabela de mensagens,
                // mas essa rota extra salva detalhes técnicos na tabela 'whatsapp_attachments' se ela existir.
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

                toast.dismiss(loadingToast);
                return apiResult;

            } catch (err) {
                toast.dismiss(loadingToast);
                throw err;
            }
        },
        onSuccess: () => {
            toast.success("Mídia enviada!");
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        ...mutationOptions,
    });

    const handleSendMessage = (e) => { 
        e.preventDefault(); 
        if (newMessage.trim()) { sendMessageMutation.mutate(newMessage); } 
    };
    
    const handleFileSelect = (e) => { 
        const file = e.target.files[0]; 
        if (file) { 
            if (file.size > 16 * 1024 * 1024) {
                toast.error("Arquivo muito grande. Tente arquivos menores que 16MB.");
                return;
            }
            sendAttachmentMutation.mutate({ file }); 
        } 
        e.target.value = null; 
    };
    
    const handleSendTemplate = (templateName, language, variables) => { 
        sendTemplateMutation.mutate({ templateName, language, variables }); 
    };

    // --- LÓGICA DE ÁUDIO (MICROFONE) ---
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
                    
                    sendAttachmentMutation.mutate({ file: audioFile });
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

    if (!contact) {
        return <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500"><FontAwesomeIcon icon={faUserCircle} size="6x" /><p className="mt-4 text-lg">Selecione uma conversa</p></div>;
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>;
    }
    
    return (
        <>
            <TemplateMessageModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} onSendTemplate={handleSendTemplate} contactName={contact?.nome} />
            <div className="flex flex-col h-full bg-[#efeae2]">
                
                {/* CABEÇALHO */}
                <div className="bg-white p-3 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white">
                            <FontAwesomeIcon icon={faUserCircle} size="lg"/>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">{contact.nome}</h3>
                            <p className="text-xs text-gray-500">{recipientPhone || "Sem número"}</p>
                        </div>
                    </div>
                    {onBack && (
                        <button onClick={onBack} className="md:hidden text-gray-600 hover:bg-gray-100 p-2 rounded">Voltar</button>
                    )}
                </div>

                {/* MENSAGENS */}
                <div className="flex-grow p-4 overflow-y-auto min-h-0 space-y-3 custom-scrollbar">
                    {messages?.map(msg => {
                        const isMe = msg.direction === 'outbound';
                        // Tenta ler o JSON do raw_payload
                        const payload = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload;
                        
                        // LÓGICA REVISADA: Prioriza a coluna 'media_url', senão pega do payload
                        const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                        
                        const isImage = payload?.type === 'image' || payload?.image;
                        const isAudio = payload?.type === 'audio' || payload?.audio;
                        const isVideo = payload?.type === 'video' || payload?.video;
                        const isDocument = payload?.type === 'document' || payload?.document;

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] lg:max-w-[60%] p-2 rounded-lg shadow-sm relative text-sm ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    
                                    {/* --- ÁREA DE MÍDIA REVISADA --- */}
                                    
                                    {/* Imagem: Agora mostra a FOTO REAL */}
                                    {isImage && mediaUrl && (
                                        <div className="mb-2 rounded overflow-hidden cursor-pointer bg-gray-100 min-h-[150px]" onClick={() => window.open(mediaUrl, '_blank')}>
                                            <img 
                                                src={mediaUrl} 
                                                alt="Imagem enviada" 
                                                className="w-full h-auto max-h-72 object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none'; // Esconde se der erro
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Áudio: Player nativo */}
                                    {isAudio && mediaUrl && (
                                        <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100 min-w-[200px]">
                                            <audio controls src={mediaUrl} className="w-full h-8" />
                                        </div>
                                    )}
                                    
                                    {/* Vídeo: Link ou miniatura */}
                                    {isVideo && (
                                        <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                                            <FontAwesomeIcon icon={faVideo} className="text-gray-500" />
                                            <span className="text-xs">Vídeo</span>
                                            {mediaUrl && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-auto">Assistir</a>}
                                        </div>
                                    )}

                                    {/* Documento */}
                                    {isDocument && (
                                        <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                                            <FontAwesomeIcon icon={faFileAlt} className="text-orange-500" />
                                            <span className="text-xs truncate max-w-[150px]">{payload?.document?.filename || "Documento"}</span>
                                            {mediaUrl && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 font-bold ml-auto">Baixar</a>}
                                        </div>
                                    )}

                                    {/* Texto da mensagem (Evita mostrar labels duplicadas se for só mídia) */}
                                    {msg.content && msg.content !== 'Imagem enviada' && msg.content !== 'Áudio enviado' && (
                                        <p className="whitespace-pre-wrap text-gray-800 mt-1">{msg.content}</p>
                                    )}
                                    
                                    <div className="text-right text-[10px] text-gray-500 mt-1 flex justify-end items-center gap-1">
                                        {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}
                                        {isMe && (
                                            <span className={msg.status === 'read' ? 'text-blue-500' : 'text-gray-400'}>
                                                {msg.status === 'read' ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT AREA */}
                <div className="p-3 bg-[#f0f2f5] border-t border-gray-200 flex-shrink-0 z-20">
                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={sendAttachmentMutation.isPending || isRecording}>
                            {sendAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperclip} size="lg" />}
                        </button>
                        
                        {!isRecording && (
                            <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="p-3 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={sendTemplateMutation.isPending}>
                                <FontAwesomeIcon icon={faFileLines} size="lg" />
                            </button>
                        )}
                        
                        <div className="flex-grow bg-white rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all flex items-center">
                            {isRecording ? (
                                <div className="flex-grow p-3 text-red-500 font-semibold animate-pulse flex items-center justify-between">
                                    <span>Gravando áudio... {formatTime(recordingTime)}</span>
                                    <FontAwesomeIcon icon={faMicrophone} beat />
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
                                    className="w-full p-3 max-h-32 bg-transparent border-none focus:ring-0 resize-none text-sm"
                                    rows={1}
                                />
                            )}
                        </div>
                        
                        {newMessage.trim() ? (
                            <button type="submit" className="p-3 rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] shadow-sm transition-colors" disabled={sendMessageMutation.isPending}>
                                {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                onClick={handleMicClick}
                                className={`p-3 w-12 h-12 flex items-center justify-center rounded-full text-white shadow-sm transition-all duration-200 ${isRecording ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-[#00a884] hover:bg-[#008f6f]'}`}
                            >
                                <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} size={isRecording ? "lg" : "1x"} />
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </>
    );
}