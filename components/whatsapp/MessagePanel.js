'use client'

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching'; 
import { sendWhatsAppText, sendWhatsAppMedia } from '@/utils/whatsapp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSmile, faPaperclip, faMicrophone, faStop, faSpinner, faFileAlt, faVideo, faImage } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MessagePanel({ contact }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    // Estados para Áudio e Upload
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null); // Referência essencial para o botão de anexo funcionar
    
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Busca mensagens
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

        // Realtime subscriptions
        const channels = [];
        if (contact.contato_id) {
            const channelId = supabase
                .channel(`chat:id:${contact.contato_id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `contato_id=eq.${contact.contato_id}` }, (payload) => {
                    setMessages((current) => [...current, payload.new]);
                })
                .subscribe();
            channels.push(channelId);
        }
        if (contact.phone_number) {
             const channelPhone = supabase
                .channel(`chat:phone:${contact.phone_number}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `sender_id=eq.${contact.phone_number}` }, (payload) => {
                    setMessages((current) => {
                        if (current.some(m => m.id === payload.new.id)) return current;
                        return [...current, payload.new];
                    });
                })
                .subscribe();
            channels.push(channelPhone);
        }
        return () => channels.forEach(ch => supabase.removeChannel(ch));
    }, [contact?.contato_id, contact?.phone_number, organizacaoId, supabase]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // --- FUNÇÃO DE PROCESSAR ARQUIVO (Imagem, Vídeo, Docs ou Áudio Gravado) ---
    const handleFileUpload = async (file) => {
        if (!file) return;
        setIsUploading(true);

        try {
            // 1. Upload para o Supabase Storage
            // Nome único para evitar conflitos
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `chat/${contact.contato_id || 'geral'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('whatsapp_media') // Certifique-se que este Bucket existe e é Público
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Obter URL Pública
            const { data: { publicUrl } } = supabase.storage
                .from('whatsapp_media')
                .getPublicUrl(filePath);

            // 3. Determinar tipo de mídia para o WhatsApp
            let type = 'document';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';

            // 4. Enviar mensagem via WhatsApp API
            const result = await sendWhatsAppMedia(
                contact.phone_number,
                type,
                publicUrl,
                type === 'document' ? file.name : '', // Caption (legenda)
                file.name // Filename
            );

            if (result.success) {
                // 5. REGISTRAR O ANEXO NO BANCO (Usando sua rota save-attachment)
                if (contact.contato_id) {
                    await fetch('/api/whatsapp/save-attachment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contato_id: contact.contato_id,
                            message_id: result.data?.messages?.[0]?.id, // ID retornado pelo WhatsApp
                            storage_path: filePath,
                            public_url: publicUrl,
                            file_name: file.name,
                            file_type: file.type,
                            file_size: file.size
                        })
                    });
                }
                toast.success('Enviado com sucesso!');
            } else {
                toast.error('Erro ao enviar para o WhatsApp.');
            }

        } catch (error) {
            console.error('Erro no upload/envio:', error);
            toast.error('Falha ao enviar arquivo. Verifique o Storage.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Limpa o input
        }
    };

    // Handler para input de arquivo
    const handleFileSelect = (e) => {
        handleFileUpload(e.target.files[0]);
    };

    // --- LÓGICA DE ÁUDIO (Microfone) ---
    const handleMicClick = async () => {
        if (isRecording) {
            mediaRecorder?.stop(); // Para a gravação
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);
                const chunks = [];

                recorder.ondataavailable = (e) => chunks.push(e.data);
                
                recorder.onstop = async () => {
                    // Cria o arquivo de áudio
                    const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                    const audioFile = new File([blob], "audio_message.ogg", { type: 'audio/ogg' });
                    
                    // Envia usando a mesma lógica de arquivo
                    await handleFileUpload(audioFile);
                    
                    // Desliga o microfone (luz vermelha do navegador)
                    stream.getTracks().forEach(track => track.stop());
                };

                recorder.start();
                setMediaRecorder(recorder);
                setIsRecording(true);
            } catch (err) {
                console.error("Erro microfone:", err);
                toast.error("Permita o acesso ao microfone.");
            }
        }
    };

    // --- ENVIO DE TEXTO ---
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !contact?.phone_number) return;

        setIsSending(true);
        try {
            const result = await sendWhatsAppText(contact.phone_number, newMessage);
            if (result.success) setNewMessage('');
            else toast.error('Erro ao enviar mensagem.');
        } catch (error) {
            console.error('Erro:', error);
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
            {/* Área de Mensagens */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="text-center text-gray-500 mt-10">Carregando...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-10 p-4 bg-white/50 rounded-lg shadow-sm mx-auto max-w-md">
                        <p>Nenhuma mensagem encontrada.</p>
                        <p className="text-xs mt-1">Envie a primeira mensagem para iniciar.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.direction === 'outbound';
                        const isMedia = msg.raw_payload?.type === 'image' || msg.raw_payload?.type === 'document' || msg.raw_payload?.type === 'audio' || msg.raw_payload?.type === 'video';
                        
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${
                                    isMe ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'
                                }`}>
                                    {isMedia ? (
                                        <div className="flex items-center gap-2 text-sm italic text-gray-600">
                                            {msg.raw_payload?.type === 'image' && <FontAwesomeIcon icon={faImage} />}
                                            {msg.raw_payload?.type === 'audio' && <FontAwesomeIcon icon={faMicrophone} />}
                                            {msg.raw_payload?.type === 'document' && <FontAwesomeIcon icon={faFileAlt} />}
                                            {msg.raw_payload?.type === 'video' && <FontAwesomeIcon icon={faVideo} />}
                                            <span>
                                                {msg.content || `[Mídia: ${msg.raw_payload?.type}]`}
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                    )}
                                    
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
                {/* Input Invisível para Arquivo */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                />

                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    {/* Botão de Anexo */}
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()} // Aciona o clique no input invisível
                        disabled={isUploading || isRecording}
                        className="p-3 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                        title="Anexar arquivo"
                    >
                        {isUploading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperclip} size="lg" />}
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
                            placeholder={isRecording ? "Gravando áudio..." : "Digite uma mensagem"}
                            disabled={isRecording}
                            className={`w-full p-3 max-h-32 bg-transparent border-none focus:ring-0 resize-none text-sm ${isRecording ? 'text-red-500 font-semibold animate-pulse' : ''}`}
                            rows={1}
                        />
                    </div>

                    {/* Botão Dinâmico: Microfone ou Enviar */}
                    {newMessage.trim() ? (
                        <button 
                            type="submit" 
                            disabled={isSending}
                            className={`p-3 rounded-full text-white transition-colors ${
                                isSending ? 'bg-gray-400' : 'bg-[#00a884] hover:bg-[#008f6f]'
                            }`}
                        >
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={handleMicClick}
                            className={`p-3 rounded-full text-white transition-all duration-200 ${
                                isRecording ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-[#00a884] hover:bg-[#008f6f]'
                            }`}
                            title={isRecording ? "Parar e Enviar" : "Gravar Áudio"}
                        >
                            <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}