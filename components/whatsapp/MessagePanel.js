'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faCloudUploadAlt, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Imports
import ChatHeader from './panel/ChatHeader';
import MessageList from './panel/MessageList';
import ChatInput from './panel/ChatInput';
import { useAudioRecorder } from './panel/useAudioRecorder';
import TemplateMessageModal from './TemplateMessageModal';
import FilePreviewModal from './FilePreviewModal';
import ChatMediaViewer from './ChatMediaViewer';
import LocationPickerModal from './LocationPickerModal'; // <--- O NOVO MODAL
import { usePersistentState } from '@/hooks/usePersistentState';
import { sendWhatsAppLocation } from '@/utils/whatsapp'; // <--- Importamos a função de envio

// --- UPPY IMPORTS ---
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// Utilitários
const sanitizeFileName = (fileName) => fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
const cleanPhoneNumber = (phone) => phone ? phone.replace(/[^0-9]/g, '') : null;
const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

const pt_BR_Uppy = {
    strings: {
        addMore: 'Adicionar mais', cancel: 'Cancelar', dashboardTitle: 'Enviar Arquivo',
        dropPasteFiles: 'Arraste arquivos aqui ou %{browse}', browse: 'selecione',
        editFile: 'Adicionar Legenda', removeFile: 'Remover arquivo', save: 'Salvar Legenda', uploading: 'Enviando...',
        complete: 'Concluído'
    }
};

export default function MessagePanel({ contact, onBack }) {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = usePersistentState(`whatsapp_draft_${contact?.contato_id}`, '');
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Estados Visuais
    const [selectedFile, setSelectedFile] = useState(null);
    const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
    const [viewerMedia, setViewerMedia] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false); // Estado do Modal de Mapa
    
    // Estado de Contato
    const [recipientPhone, setRecipientPhone] = useState(null);
    const recipientPhoneRef = useRef(recipientPhone);
    const dashboardContainerRef = useRef(null);

    // --- Uppy Setup ---
    const [uppy] = useState(() => {
        if (typeof window === 'undefined') return null;
        const uppyInstance = new Uppy({
            id: 'whatsapp-uploader-v4-ptbr', locale: pt_BR_Uppy, autoProceed: false,
            restrictions: { maxFileSize: 64 * 1024 * 1024, maxNumberOfFiles: 1 },
            meta: { caption: '' }
        });
        uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
        return uppyInstance;
    });

    // --- Queries ---
    const { data: messages, isLoading } = useQuery({
        queryKey: ['messages', organizacaoId, contact?.contato_id],
        queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
        enabled: !!organizacaoId && !!contact,
        refetchInterval: 5000,
    });

    // Determine Recipient Phone
    useEffect(() => {
        if (messages && messages.length > 0) {
            const inboundMsg = messages.find(m => m.direction === 'inbound');
            if (inboundMsg?.sender_id) { setRecipientPhone(inboundMsg.sender_id); return; }
            const outboundMsg = messages.find(m => m.direction === 'outbound');
            if (outboundMsg?.receiver_id) { setRecipientPhone(outboundMsg.receiver_id); }
        } else if (contact?.phone_number || contact?.telefone) {
            setRecipientPhone(contact.phone_number || contact.telefone);
        }
    }, [messages, contact]);

    useEffect(() => { recipientPhoneRef.current = recipientPhone; }, [recipientPhone]);

    // Mark as Read
    const markReadMutation = useMutation({
        mutationFn: async () => {
             if (!contact?.contato_id || !organizacaoId) return;
             await fetch('/api/whatsapp/mark-read', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact_id: contact.contato_id, organizacaoId: organizacaoId })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        }
    });

    useEffect(() => {
        if (contact?.contato_id && messages) {
            const hasUnread = messages.some(m => m.direction === 'inbound' && m.is_read === false);
            if (hasUnread) markReadMutation.mutate();
        }
    }, [contact?.contato_id, messages]);

    // Realtime
    useEffect(() => {
        if (!contact || !organizacaoId) return;
        const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `organizacao_id=eq.${organizacaoId}` }, 
                (payload) => {
                    const isRelevant = payload.new.contato_id === contact.contato_id || payload.new.sender_id === recipientPhone;
                    if (isRelevant) queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
                    queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
                }
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [contact, organizacaoId, recipientPhone, supabase, queryClient]);

    // --- MUTAÇÕES ---

    // 1. Enviar Texto
    const sendMessageMutation = useMutation({
        mutationFn: async (messageContent) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: cleanPhoneNumber(recipientPhone), type: 'text', text: messageContent, contact_id: contact.contato_id }),
            });
            if (!response.ok) throw new Error('Falha ao enviar mensagem');
            return response.json();
        },
        onSuccess: () => {
            setNewMessage('');
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        onError: (e) => toast.error(e.message)
    });

    // 2. Enviar Anexo
    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file, caption }) => {
             const rawPhone = recipientPhoneRef.current || contact?.phone_number || contact?.telefone;
             const targetPhone = cleanPhoneNumber(rawPhone);
             if (!targetPhone) throw new Error("Número do destinatário não encontrado.");
             
             const cleanName = sanitizeFileName(file.name);
             const uniqueName = `upload_${Date.now()}_${cleanName}`;
             const date = new Date();
             const filePath = `chat/${contact.contato_id}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${uniqueName}`;
             
             const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file, { contentType: file.type });
             if (uploadError) throw new Error(`Erro upload: ${uploadError.message}`);
             
             const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
             
             const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: targetPhone, type: getAttachmentType(file.type), link: urlData.publicUrl, filename: cleanName, caption: caption || '',
                    contact_id: contact.contato_id
                }),
            });
            const apiResult = await response.json();
            if (!response.ok) throw new Error(apiResult.error);
            
             await fetch('/api/whatsapp/save-attachment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contato_id: contact.contato_id, message_id: apiResult.data?.messages?.[0]?.id,
                    storage_path: filePath, public_url: urlData.publicUrl, file_name: cleanName,
                    file_type: file.type, file_size: file.size, organizacao_id: organizacaoId
                })
            });
            return apiResult;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        onError: (e) => toast.error(e.message)
    });

    // 3. Enviar Localização (A CORREÇÃO DO BUG)
    const sendLocationMutation = useMutation({
        mutationFn: async ({ latitude, longitude }) => {
            const rawPhone = recipientPhoneRef.current || contact?.phone_number || contact?.telefone;
            const targetPhone = cleanPhoneNumber(rawPhone);
            if (!targetPhone) throw new Error("Número não encontrado.");

            // Chama a função da utils, mas dentro do Mutation para atualizar a lista depois
            const result = await sendWhatsAppLocation(targetPhone, latitude, longitude, "Localização Fixada", "");
            if (!result.success) throw new Error(result.error);
            return result;
        },
        onSuccess: () => {
            toast.success("Localização enviada!");
            // ESTA LINHA ABAIXO É O SEGREDO: Ela força a lista de mensagens a recarregar
            queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
        },
        onError: (e) => toast.error("Erro ao enviar local: " + e.message)
    });

    // Handlers
    const handleSendMessage = (e) => { e.preventDefault(); if (newMessage.trim()) sendMessageMutation.mutate(newMessage); };
    const handleSendAudio = async ({ file, caption }) => { sendAttachmentMutation.mutate({ file, caption }); };
    const recorder = useAudioRecorder(handleSendAudio);
    const handleMediaClick = (media) => { setViewerMedia(media); setIsViewerOpen(true); };
    const handlePasteFile = (file) => { setSelectedFile(file); setIsFilePreviewOpen(true); };

    // Uppy Effects
    useEffect(() => {
        if (!uppy || !dashboardContainerRef.current) return;
        if (!uppy.getPlugin('Dashboard')) {
            uppy.use(DashboardPlugin, {
                id: 'Dashboard', target: dashboardContainerRef.current, inline: true, width: '100%', height: 380,
                showProgressDetails: true, hideUploadButton: false, note: "Para legenda, clique no lápis.",
                metaFields: [{ id: 'caption', name: 'Legenda', placeholder: 'Legenda...' }]
            });
        }
    }, [uppy, isUploaderOpen]);

    useEffect(() => {
        if (!uppy) return;
        const uploaderFunction = async (fileIDs) => {
            if (fileIDs.length === 0) return Promise.resolve();
            const promises = fileIDs.map(async (id) => {
                const file = uppy.getFile(id);
                try {
                    await sendAttachmentMutation.mutateAsync({ file: file.data, caption: file.meta.caption });
                    uppy.emit('upload-success', file, { status: 200 });
                    uppy.removeFile(id);
                    setIsUploaderOpen(false);
                } catch (err) {
                    uppy.emit('upload-error', file, err);
                    throw err;
                }
            });
            return Promise.all(promises);
        };
        uppy.addUploader(uploaderFunction);
    }, [uppy, sendAttachmentMutation]);

    // Renders
    if (!contact) return <div className="flex flex-col items-center justify-center h-full bg-[#efeae2] border-l border-gray-300"><div className="text-center"><FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-6xl mb-4" /><h2 className="text-xl text-gray-500 font-light">Selecione uma conversa</h2></div></div>;
    if (isLoading) return <div className="flex items-center justify-center h-full bg-[#efeae2]"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" /></div>;

    return (
        <>
            <TemplateMessageModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} contactName={contact?.nome} />
            <FilePreviewModal isOpen={isFilePreviewOpen} onClose={() => setIsFilePreviewOpen(false)} file={selectedFile} onSend={(f, c) => sendAttachmentMutation.mutate({ file: f, caption: c })} />
            <ChatMediaViewer isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} mediaUrl={viewerMedia?.url} mediaType={viewerMedia?.type} fileName={viewerMedia?.name} />
            
            {/* Modal de Mapa */}
            <LocationPickerModal 
                isOpen={isLocationModalOpen} 
                onClose={() => setIsLocationModalOpen(false)} 
                onSend={(loc) => sendLocationMutation.mutate(loc)} 
            />

            <link href={UPPY_CSS_URL} rel="stylesheet" />

            {isUploaderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-500" /> Enviar Arquivo</h3>
                            <button onClick={() => setIsUploaderOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                        </div>
                        <div className="p-2 bg-white flex-grow overflow-y-auto"><div ref={dashboardContainerRef} /></div>
                    </div>
                </div>
            )}

            <div className="flex flex-col h-full bg-[#efeae2] relative pt-[64px] md:pt-0">
                <ChatHeader contact={contact} recipientPhone={recipientPhone} onBack={onBack} />
                
                <MessageList messages={messages} onMediaClick={handleMediaClick} />
                
                <ChatInput 
                    newMessage={newMessage} 
                    setNewMessage={setNewMessage} 
                    onSendMessage={handleSendMessage}
                    onOpenUploader={() => setIsUploaderOpen(true)}
                    onOpenTemplate={() => setIsTemplateModalOpen(true)}
                    
                    // Passamos a função para abrir o modal de mapa
                    onOpenLocation={() => setIsLocationModalOpen(true)}
                    
                    recorder={recorder}
                    uploadingOrProcessing={sendAttachmentMutation.isPending || sendLocationMutation.isPending}
                    onPasteFile={handlePasteFile}
                    recipientPhone={cleanPhoneNumber(recipientPhone)}
                />
            </div>
        </>
    );
}