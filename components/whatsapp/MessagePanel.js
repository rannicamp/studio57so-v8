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
    faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';

// Helper para identificar o tipo de arquivo
const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

export default function MessagePanel({ contact, onBack }) {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    
    // Estados para Áudio
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);

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
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);
    
    // Realtime
    useEffect(() => {
        if (!contact) return;
        const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
                if (payload.new.contato_id === contact.contato_id) {
                    queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
                }
                queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
                // toast.info("Nova mensagem recebida!"); // Opcional: remover para não poluir
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [contact, organizacaoId, supabase, queryClient]);

    const mutationOptions = {
        onError: (error) => toast.error(`Erro: ${error.message}`),
        onSettled: () => toast.dismiss(),
    };

    // Mutação de Envio de Texto
    const sendMessageMutation = useMutation({
        mutationFn: async (messageContent) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: recipientPhone, type: 'text', text: messageContent }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar mensagem');
            return response.json();
        },
        onSuccess: () => setNewMessage(''),
        ...mutationOptions,
    });

    // Mutação de Template
    const sendTemplateMutation = useMutation({
        mutationFn: async ({ templateName, language, variables }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const components = variables.length > 0 ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }] : [];
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: recipientPhone, type: 'template', templateName: templateName, languageCode: language, components: components }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar modelo');
            return response.json();
        },
        onSuccess: () => setIsTemplateModalOpen(false),
        ...mutationOptions,
    });

    // Mutação de Anexo (Arquivo ou Áudio)
    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            toast.loading("Enviando mídia...");
            
            // 1. Upload para Supabase (CORRIGIDO NOME DO BUCKET)
            const fileExt = file.name.split('.').pop();
            const fileNameForUpload = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `chat/${contact.contato_id}/${fileNameForUpload}`;
            
            // ATENÇÃO: O bucket correto é 'whatsapp_media' (underline), não 'whatsapp-media'
            const { error: uploadError } = await supabase.storage
                .from('whatsapp_media') 
                .upload(filePath, file);
                
            if (uploadError) throw new Error(`Falha no upload (Storage): ${uploadError.message}`);
            
            const { data: { publicUrl } } = supabase.storage
                .from('whatsapp_media')
                .getPublicUrl(filePath);
                
            if (!publicUrl) throw new Error("Não foi possível gerar URL pública.");

            // 2. Enviar via API do WhatsApp
            const attachmentType = getAttachmentType(file.type);
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: recipientPhone, 
                    type: attachmentType, 
                    link: publicUrl, 
                    filename: file.name, 
                    caption: attachmentType === 'document' ? file.name : '' 
                }),
            });
            
            const apiResult = await response.json();
            if (!response.ok) throw new Error(apiResult.error || 'Falha ao enviar anexo via WhatsApp');

            // 3. Salvar registro na tabela whatsapp_attachments (Via API para evitar RLS)
            await fetch('/api/whatsapp/save-attachment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contato_id: contact.contato_id,
                    message_id: apiResult.data?.messages?.[0]?.id,
                    storage_path: filePath,
                    public_url: publicUrl,
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size
                })
            });

            return apiResult;
        },
        onSuccess: () => toast.success("Enviado com sucesso!"),
        ...mutationOptions,
    });

    const handleSendMessage = (e) => { 
        e.preventDefault(); 
        if (newMessage.trim()) { sendMessageMutation.mutate(newMessage); } 
    };
    
    const handleFileSelect = (e) => { 
        const file = e.target.files[0]; 
        if (file) { sendAttachmentMutation.mutate({ file }); } 
        e.target.value = null; 
    };
    
    const handleSendTemplate = (templateName, language, variables) => { 
        sendTemplateMutation.mutate({ templateName, language, variables }); 
    };

    // --- LÓGICA DE ÁUDIO (MICROFONE) ---
    const handleMicClick = async () => {
        if (isRecording) {
            // Parar
            mediaRecorder?.stop();
            setIsRecording(false);
        } else {
            // Gravar
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);
                const chunks = [];

                recorder.ondataavailable = (e) => chunks.push(e.data);
                
                recorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                    const audioFile = new File([blob], "audio_message.ogg", { type: 'audio/ogg' });
                    // Envia usando a mesma mutação de anexo
                    sendAttachmentMutation.mutate({ file: audioFile });
                    
                    stream.getTracks().forEach(track => track.stop()); // Desliga luz do mic
                };

                recorder.start();
                setMediaRecorder(recorder);
                setIsRecording(true);
            } catch (err) {
                console.error("Erro mic:", err);
                toast.error("Permita o acesso ao microfone.");
            }
        }
    };

    if (!contact) {
        return <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500"><FontAwesomeIcon icon={faUserCircle} size="6x" /><p className="mt-4 text-lg">Selecione uma conversa para começar</p></div>;
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>;
    }
    
    return (
        <>
            <TemplateMessageModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} onSendTemplate={handleSendTemplate} contactName={contact?.nome} />
            <div className="flex flex-col h-full bg-[#efeae2]">
                
                {/* ÁREA DE MENSAGENS */}
                <div className="flex-grow p-4 overflow-y-auto min-h-0 space-y-3">
                    {messages?.map(msg => {
                        const isMe = msg.direction === 'outbound';
                        // Checagem simples se é mídia
                        const isMedia = msg.raw_payload?.type === 'image' || msg.raw_payload?.type === 'document' || msg.raw_payload?.type === 'audio' || msg.raw_payload?.type === 'video';

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] lg:max-w-[60%] p-3 rounded-lg shadow-sm relative ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    {isMedia ? (
                                        <div className="flex items-center gap-2 text-sm italic text-gray-600 mb-1">
                                            {msg.raw_payload?.type === 'image' && <FontAwesomeIcon icon={faImage} />}
                                            {msg.raw_payload?.type === 'audio' && <FontAwesomeIcon icon={faMicrophone} />}
                                            {msg.raw_payload?.type === 'document' && <FontAwesomeIcon icon={faFileAlt} />}
                                            {msg.raw_payload?.type === 'video' && <FontAwesomeIcon icon={faVideo} />}
                                            <span>Mídia: {msg.raw_payload?.type}</span>
                                        </div>
                                    ) : null}
                                    
                                    <p className="text-sm whitespace-pre-wrap text-gray-800">{msg.content}</p>
                                    
                                    <div className="text-right text-[10px] text-gray-500 mt-1 flex justify-end items-center gap-1">
                                        {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}
                                        {isMe && (
                                            <span>{msg.status === 'read' ? '✓✓' : '✓'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* RODAPÉ */}
                <div className="p-3 bg-[#f0f2f5] border-t border-gray-200 flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                        {/* Input Oculto */}
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        
                        {/* Botão Anexo */}
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={sendAttachmentMutation.isPending}>
                            {sendAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperclip} size="lg" />}
                        </button>
                        
                        {/* Botão Template */}
                        <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="p-3 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={sendTemplateMutation.isPending}>
                            {sendTemplateMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileLines} size="lg" />}
                        </button>
                        
                        {/* Input de Texto */}
                        <div className="flex-grow bg-white rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                            <textarea 
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)} 
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                placeholder={isRecording ? "Gravando áudio..." : "Digite uma mensagem"} 
                                disabled={isRecording}
                                className={`w-full p-3 max-h-32 bg-transparent border-none focus:ring-0 resize-none text-sm ${isRecording ? 'text-red-500 font-bold placeholder-red-400' : ''}`}
                                rows={1}
                            />
                        </div>
                        
                        {/* Botão Dinâmico: Enviar ou Microfone */}
                        {newMessage.trim() ? (
                            <button type="submit" className="p-3 rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] shadow-sm transition-colors" disabled={sendMessageMutation.isPending}>
                                {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                onClick={handleMicClick}
                                className={`p-3 rounded-full text-white shadow-sm transition-all duration-200 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' : 'bg-[#00a884] hover:bg-[#008f6f]'}`}
                            >
                                <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} />
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </>
    );
}