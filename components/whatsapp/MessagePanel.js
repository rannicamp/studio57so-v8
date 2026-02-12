'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPaperPlane, faSpinner, faUserCircle, faPaperclip, faFileLines,
    faMicrophone, faStop, faVideo, faFileAlt, faCheck, faCheckDouble, 
    faPlayCircle, faArrowLeft, faEllipsisVertical, faSearch, faExclamationCircle,
    faCloudUploadAlt, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';
import FilePreviewModal from './FilePreviewModal';
import ChatMediaViewer from './ChatMediaViewer';
import { usePersistentState } from '@/hooks/usePersistentState';

// --- UPPY IMPORTS ---
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

// CSS DO UPPY
const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// --- TRADUÇÃO PT-BR COMPLETA ---
const pt_BR = {
  strings: {
    addMore: 'Adicionar mais',
    addMoreFiles: 'Adicionar mais arquivos',
    browse: 'selecione',
    browseFiles: 'selecionar arquivos',
    cancel: 'Cancelar',
    cancelUpload: 'Cancelar envio',
    complete: 'Concluído',
    dashboardTitle: 'Enviar Arquivo',
    dropPasteFiles: 'Arraste arquivos aqui ou %{browse}',
    editFile: 'Adicionar Legenda',
    editing: 'Editando %{file}',
    fileProgress: 'Progresso: velocidade e tempo restante',
    myDevice: 'Meu Dispositivo',
    removeFile: 'Remover arquivo',
    save: 'Salvar Legenda',
    saveChanges: 'Salvar alterações',
    uploadXFiles: {
      0: 'Enviar %{smart_count} arquivo',
      1: 'Enviar %{smart_count} arquivo'
    },
    uploading: 'Enviando...',
    xFilesSelected: {
      0: '%{smart_count} selecionado',
      1: '%{smart_count} selecionado'
    },
  }
};

const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

const sanitizeFileName = (fileName) => {
    return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
};

const cleanPhoneNumber = (phone) => {
    if (!phone) return null;
    return phone.replace(/[^0-9]/g, '');
};

export default function MessagePanel({ contact, onBack }) {
    const queryClient = useQueryClient();
    
    const [newMessage, setNewMessage] = usePersistentState(`whatsapp_draft_${contact?.contato_id}`, '');
    
    // Estados Originais
    const [selectedFile, setSelectedFile] = useState(null);
    const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
    const [viewerMedia, setViewerMedia] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    
    // --- ESTADOS DO UPPY ---
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const dashboardContainerRef = useRef(null);

    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioDataRef = useRef([]);
    const recordingInterval = useRef(null);
    const messagesEndRef = useRef(null);
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [recipientPhone, setRecipientPhone] = useState(null);
    const recipientPhoneRef = useRef(recipientPhone);

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- 1. LÓGICA DE REABERTURA AUTOMÁTICA (ANTI-CRASH) ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const wasOpen = localStorage.getItem('whatsappUploaderOpen');
            if (wasOpen === 'true') {
                setIsUploaderOpen(true);
            }
        }
    }, []);

    const openUploader = () => {
        setIsUploaderOpen(true);
        if (typeof window !== 'undefined') localStorage.setItem('whatsappUploaderOpen', 'true');
    };

    const closeUploader = () => {
        setIsUploaderOpen(false);
        if (typeof window !== 'undefined') localStorage.removeItem('whatsappUploaderOpen');
    };

    // --- 2. CONFIGURAÇÃO DO UPPY ---
    const [uppy] = useState(() => {
        if (typeof window === 'undefined') return null;
    
        const uppyInstance = new Uppy({
          id: 'whatsapp-uploader-v4-ptbr',
          locale: pt_BR,
          autoProceed: false,
          debug: true,
          restrictions: {
            maxFileSize: 64 * 1024 * 1024, 
            maxNumberOfFiles: 1, 
            allowedFileTypes: ['image/*', 'video/*', '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
          },
          meta: { caption: '' }
        });
    
        uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
        return uppyInstance;
    });

    // --- 3. CONFIGURAÇÃO DO DASHBOARD VISUAL ---
    useEffect(() => {
        if (!uppy || !dashboardContainerRef.current) return;
    
        if (!uppy.getPlugin('Dashboard')) {
          uppy.use(DashboardPlugin, {
            id: 'Dashboard',
            target: dashboardContainerRef.current,
            inline: true,
            width: '100%',
            height: 380,
            showProgressDetails: true,
            hideUploadButton: false,
            note: "Para adicionar legenda, clique no ícone de lápis na imagem.",
            metaFields: [
              { 
                id: 'caption', 
                name: 'Legenda da Mensagem', 
                placeholder: 'Digite aqui a legenda para enviar junto...' 
              }
            ]
          });
        }
    }, [uppy, isUploaderOpen]);

    useEffect(() => {
        if (typeof window !== 'undefined' && !window.lamejs) {
            const script = document.createElement('script');
            script.src = '/lame.min.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    const { data: messages, isLoading } = useQuery({
        queryKey: ['messages', organizacaoId, contact?.contato_id],
        queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
        enabled: !!organizacaoId && !!contact,
        refetchInterval: 5000,
    });

    const markReadMutation = useMutation({
        mutationFn: async () => {
             if (!contact?.contato_id || !organizacaoId) return;
             await fetch('/api/whatsapp/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // CORREÇÃO: Enviando organizacaoId conforme a API espera
                body: JSON.stringify({ 
                    contact_id: contact.contato_id, 
                    organizacaoId: organizacaoId 
                })
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
            if (hasUnread) { markReadMutation.mutate(); }
        }
    }, [contact?.contato_id, messages]);

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

    useEffect(() => {
        recipientPhoneRef.current = recipientPhone;
    }, [recipientPhone]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (!contact || !organizacaoId) return;
        // Inscrição no canal para mensagens novas e atualizações (Reactions trigger UPDATE)
        const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `organizacao_id=eq.${organizacaoId}` }, 
                (payload) => {
                    const isRelevant = 
                        payload.new.contato_id === contact.contato_id || 
                        payload.new.sender_id === recipientPhone || 
                        payload.new.receiver_id === recipientPhone;

                    if (isRelevant) {
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

    const sendMessageMutation = useMutation({
        mutationFn: async (messageContent) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: cleanPhoneNumber(recipientPhone), 
                    type: 'text', 
                    text: messageContent,
                    contact_id: contact.contato_id
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

    const sendTemplateMutation = useMutation({
        mutationFn: async ({ templateName, language, variables, fullText, components }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const payloadComponents = components || (
                variables.length > 0 ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }] : []
            );

            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: cleanPhoneNumber(recipientPhone), 
                    type: 'template', 
                    templateName, languageCode: language, 
                    components: payloadComponents, 
                    contact_id: contact.contato_id, 
                    custom_content: fullText 
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

    // --- CONECTOR UPPY -> ENVIO BLINDADO ---
    useEffect(() => {
        if (!uppy) return;
    
        const uploaderFunction = async (fileIDs) => {
          if (fileIDs.length === 0) return Promise.resolve();
    
          const promises = fileIDs.map(async (id) => {
            const file = uppy.getFile(id);
            const caption = file.meta.caption || ''; 

            const rawPhone = recipientPhoneRef.current || contact?.phone_number || contact?.telefone;
            const targetPhone = cleanPhoneNumber(rawPhone);

            if (!targetPhone) {
                const errorMsg = "Número de telefone inválido.";
                toast.error(errorMsg);
                uppy.emit('upload-error', file, { message: errorMsg });
                throw new Error(errorMsg);
            }
    
            try {
              uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.data.size });
    
              const cleanName = sanitizeFileName(file.name);
              const fileExt = cleanName.split('.').pop();
              const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
              const date = new Date();
              const filePath = `chat/${contact.contato_id}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${uniqueName}`;
              
              const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file.data, { contentType: file.type });
              if (uploadError) throw new Error(`Erro no upload Storage: ${uploadError.message}`);

              uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: file.data.size, bytesTotal: file.data.size });
              
              const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
              
              const response = await fetch('/api/whatsapp/send', {
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      to: targetPhone, 
                      type: getAttachmentType(file.type), 
                      link: urlData.publicUrl, 
                      filename: cleanName, 
                      caption: caption || '',
                      contact_id: contact.contato_id
                  }),
              });
              
              const apiResult = await response.json();
              if (!response.ok) throw new Error(apiResult.error || 'A Meta recusou o arquivo.');

              await fetch('/api/whatsapp/save-attachment', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      contato_id: contact.contato_id, 
                      message_id: apiResult.data?.messages?.[0]?.id, 
                      storage_path: filePath, 
                      public_url: urlData.publicUrl, 
                      file_name: cleanName,
                      file_type: file.type, 
                      file_size: file.size, 
                      organizacao_id: organizacaoId
                  })
              });
    
              uppy.emit('upload-success', file, { uploadURL: urlData.publicUrl, status: 200, body: apiResult });
              toast.success("Arquivo enviado!");
              uppy.removeFile(id);
              
              closeUploader();
              queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
    
            } catch (err) {
              console.error("Erro no envio:", err);
              uppy.emit('upload-error', file, err);
              toast.error("Erro: " + err.message);
              throw err;
            }
          });
    
          return Promise.all(promises);
        };
    
        uppy.addUploader(uploaderFunction);
    }, [uppy, contact, organizacaoId]); 

    // Lógica de Áudio (Mantida)
    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file, caption }) => {
             const rawPhone = recipientPhoneRef.current || contact?.phone_number || contact?.telefone;
             const targetPhone = cleanPhoneNumber(rawPhone);
             if (!targetPhone) throw new Error("Número do destinatário não encontrado.");
             
             const cleanName = sanitizeFileName(file.name);
             const uniqueName = `audio_${Date.now()}.mp3`;
             const date = new Date();
             const filePath = `chat/${contact.contato_id}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${uniqueName}`;
             
             const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file, { contentType: file.type });
             if (uploadError) throw new Error(`Erro upload audio: ${uploadError.message}`);
             
             const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
             
             const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: targetPhone, type: 'audio', link: urlData.publicUrl, filename: cleanName, caption: '',
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
        }
    });

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } });
            mediaStreamRef.current = stream;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            audioDataRef.current = [];
            processor.onaudioprocess = (e) => { audioDataRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
            source.connect(processor); processor.connect(audioContext.destination);
            setIsRecording(true); setRecordingTime(0); recordingInterval.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) { toast.error("Erro mic: " + err.message); }
    };

    const stopRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false); setIsProcessingAudio(true);
        if (recordingInterval.current) clearInterval(recordingInterval.current);
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
        const finalSampleRate = audioContextRef.current?.sampleRate || 44100;
        if (audioContextRef.current) { await audioContextRef.current.close(); audioContextRef.current = null; }
        try { await convertAndSendMp3(audioDataRef.current, finalSampleRate); } 
        catch (error) { toast.error("Erro conversão: " + error.message); } 
        finally { setIsProcessingAudio(false); audioDataRef.current = []; }
    };

    const convertAndSendMp3 = async (buffers, sampleRate) => {
        if (!buffers || !buffers.length) return;
        if (!window.lamejs) throw new Error("Aguarde o carregamento do conversor.");
        const mp3Encoder = new window.lamejs.Mp3Encoder(1, sampleRate, 192);
        const mp3Data = [];
        let totalLength = 0;
        for (let i = 0; i < buffers.length; i++) totalLength += buffers[i].length;
        const samples = new Int16Array(totalLength);
        let offset = 0;
        for (let i = 0; i < buffers.length; i++) {
            for (let j = 0; j < buffers[i].length; j++) {
                let s = Math.max(-1, Math.min(1, buffers[i][j]));
                samples[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
        }
        const sampleBlockSize = 1152;
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            const mp3buf = mp3Encoder.encodeBuffer(samples.subarray(i, i + sampleBlockSize));
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        const mp3buf = mp3Encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
        const mp3File = new File([new Blob(mp3Data, { type: 'audio/mpeg' })], `audio_${Date.now()}.mp3`, { type: 'audio/mpeg' });
        sendAttachmentMutation.mutate({ file: mp3File, caption: '' });
    };

    const handleSendMessage = (e) => { e.preventDefault(); if (newMessage.trim()) sendMessageMutation.mutate(newMessage); };
    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    if (!contact) return <div className="flex flex-col items-center justify-center h-full bg-[#efeae2] border-l border-gray-300"><div className="text-center"><FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-6xl mb-4" /><h2 className="text-xl text-gray-500 font-light">Selecione uma conversa</h2></div></div>;
    if (isLoading) return <div className="flex items-center justify-center h-full bg-[#efeae2]"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-[#00a884]" /></div>;

    return (
        <>
            <TemplateMessageModal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setIsTemplateModalOpen(false)} 
                onSendTemplate={(t, l, v, txt, comp) => sendTemplateMutation.mutate({ templateName: t, language: l, variables: v, fullText: txt, components: comp })} 
                contactName={contact?.nome} 
            />
            {/* FilePreviewModal mantido apenas se precisar abrir arquivos antigos */}
            <FilePreviewModal isOpen={isFilePreviewOpen} onClose={() => setIsFilePreviewOpen(false)} file={selectedFile} onSend={(f, c) => sendAttachmentMutation.mutate({ file: f, caption: c })} />
            <ChatMediaViewer isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} mediaUrl={viewerMedia?.url} mediaType={viewerMedia?.type} fileName={viewerMedia?.name} />
            <link href={UPPY_CSS_URL} rel="stylesheet" />

            {/* --- MODAL DE UPLOAD (UPPY) --- */}
            {isUploaderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-500" />
                        Enviar Arquivo
                    </h3>
                    <button onClick={closeUploader} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                    </div>
                    <div className="p-2 bg-white flex-grow overflow-y-auto">
                    <div ref={dashboardContainerRef} />
                    </div>
                    <div className="p-3 bg-blue-50 text-xs text-blue-700 text-center border-t border-blue-100">
                    💡 Dica: Clique em <b>"Adicionar Legenda"</b> (ícone de lápis) para escrever uma mensagem junto com o arquivo.
                    </div>
                </div>
                </div>
            )}

            <div className="flex flex-col h-full bg-[#efeae2] relative">
                {/* Header */}
                <div className="bg-[#f0f2f5] px-4 py-2 border-b border-gray-300 flex items-center justify-between shadow-sm z-10 sticky top-0 h-16">
                    <div className="flex items-center gap-3 w-full">
                        {onBack && (
                            <button onClick={onBack} className="md:hidden text-[#54656f] p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors">
                                <FontAwesomeIcon icon={faArrowLeft} className="text-xl" />
                            </button>
                        )}
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer">
                             <FontAwesomeIcon icon={faUserCircle} className="text-white text-3xl"/>
                        </div>
                        <div className="flex flex-col justify-center flex-grow overflow-hidden">
                            <h3 className="font-medium text-[#111b21] leading-tight truncate text-base">{contact.nome}</h3>
                            <p className="text-[13px] text-[#667781] truncate">{recipientPhone || "Toque para dados do contato"}</p>
                        </div>
                        <div className="flex items-center gap-4 text-[#54656f]">
                            <button className="hidden sm:block p-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faSearch} /></button>
                            <button className="p-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faEllipsisVertical} /></button>
                        </div>
                    </div>
                </div>

                {/* Lista de Mensagens */}
                <div className="flex-grow p-4 overflow-y-auto space-y-2 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
                    {messages?.map(msg => {
                        const isMe = msg.direction === 'outbound';
                        let payload = {}; try { payload = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload; } catch (e) {}
                        
                        const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                        const isImage = payload?.type === 'image' || payload?.image; const isAudio = payload?.type === 'audio' || payload?.audio;
                        const isVideo = payload?.type === 'video' || payload?.video; const isDocument = payload?.type === 'document' || payload?.document;
                        const hiddenTexts = ['Imagem', 'Áudio', 'Documento', 'Vídeo', 'Áudio enviado', 'Imagem enviada', 'Vídeo enviado'];
                        
                        // --- LÓGICA DE REAÇÃO (JOINHA) ---
                        const reaction = msg.reaction_data; // { emoji: "👍", ... }

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                                <div className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm group ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    <div className="p-1">
                                        {isImage && mediaUrl && <div className="rounded overflow-hidden mb-1 cursor-pointer bg-[#cfd4d2]" onClick={() => { setViewerMedia({ url: mediaUrl, type: 'image' }); setIsViewerOpen(true); }}><img src={mediaUrl} className="w-full h-auto max-h-80 object-cover" loading="lazy" /></div>}
                                        {isVideo && mediaUrl && <div className="rounded overflow-hidden mb-1 bg-black relative flex items-center justify-center min-h-[150px]"><button className="absolute inset-0 z-20 w-full h-full cursor-pointer opacity-0" onClick={() => { setViewerMedia({ url: mediaUrl, type: 'video' }); setIsViewerOpen(true); }}></button><div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg"><FontAwesomeIcon icon={faPlayCircle} size="2x" /></div></div><video src={mediaUrl} className="w-full max-h-80 opacity-80 pointer-events-none object-cover" /></div>}
                                        {isAudio && (mediaUrl ? (<div className="flex items-center gap-2 p-2 min-w-[240px]"><div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><FontAwesomeIcon icon={faMicrophone} /></div><audio controls src={mediaUrl} className="h-8 w-full max-w-[200px]" /></div>) : (<div className="flex items-center gap-2 p-2 text-red-500 bg-red-50 rounded"><FontAwesomeIcon icon={faExclamationCircle} /><span className="text-xs">Erro: Áudio sem link</span></div>))}
                                        {isDocument && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors no-underline"><FontAwesomeIcon icon={faFileAlt} className="text-[#e55050] text-2xl" /><div className="overflow-hidden"><p className="font-medium text-gray-700 truncate">{payload?.document?.filename || "Documento"}</p></div></a>}
                                        {msg.content && !hiddenTexts.includes(msg.content) && <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                                    </div>
                                    <div className="flex justify-end items-center gap-1 px-2 pb-1 mt-[-4px]"><span className="text-[10px] text-gray-500">{msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}</span>{isMe && <FontAwesomeIcon icon={msg.status === 'read' ? faCheckDouble : msg.status === 'delivered' ? faCheckDouble : faCheck} className={msg.status === 'read' ? "text-[#53bdeb]" : "text-gray-500"} />}</div>
                                    
                                    {/* --- VISUALIZAÇÃO DA REAÇÃO --- */}
                                    {reaction && reaction.emoji && (
                                        <div className="absolute -bottom-2 -right-1 bg-white rounded-full p-1 shadow-md border border-gray-100 text-xs z-10 animate-in fade-in zoom-in duration-200">
                                            {reaction.emoji}
                                        </div>
                                    )}

                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-2 z-20">
                    <button onClick={openUploader} className="text-gray-500 hover:text-gray-700 p-2" disabled={sendAttachmentMutation.isPending || isProcessingAudio}><FontAwesomeIcon icon={faPaperclip} size="lg" /></button>
                    {!isRecording && !isProcessingAudio && <button onClick={() => setIsTemplateModalOpen(true)} className="text-gray-500 hover:text-gray-700 p-2"><FontAwesomeIcon icon={faFileLines} size="lg" /></button>}
                    <div className="flex-grow bg-white rounded-lg border border-white flex items-center py-2 px-4 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
                        {isRecording ? <div className="flex-grow flex items-center text-red-500 font-medium animate-pulse"><span><FontAwesomeIcon icon={faMicrophone} className="mr-2" /> Gravando... {formatTime(recordingTime)}</span></div> : isProcessingAudio ? <div className="flex-grow flex items-center gap-2 text-gray-500 font-medium"><FontAwesomeIcon icon={faSpinner} spin /> Processando áudio...</div> : <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} placeholder="Digite uma mensagem" className="w-full bg-transparent border-none focus:ring-0 resize-none text-gray-700 max-h-24 custom-scrollbar p-0 placeholder-gray-400" rows={1} style={{ minHeight: '24px' }} />}
                    </div>
                    {newMessage.trim() ? <button onClick={handleSendMessage} disabled={sendMessageMutation.isPending || isProcessingAudio} className="text-[#00a884] hover:text-[#008f6f] p-2">{sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin size="lg"/> : <FontAwesomeIcon icon={faPaperPlane} size="lg" />}</button> : <button onClick={isRecording ? stopRecording : startRecording} disabled={isProcessingAudio} className={`p-2 ${isRecording ? 'text-red-500 hover:text-red-600 scale-110' : 'text-gray-500 hover:text-gray-700'}`}>{isProcessingAudio ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} size="lg" />}</button>}
                </div>
            </div>
        </>
    );
}