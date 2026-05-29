"use client";

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, faSpinner, faCheckDouble, faWandMagicSparkles, faUndo,
  faPaperclip, faMicrophone, faMapMarkerAlt, faFileAlt, faPlayCircle, 
  faDownload, faTrash, faCheck, faHeadphones, faImage, faVideo
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation, useChatMessages, useSendMessage, useMarkAsRead } from './ChatHooks';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useAudioRecorder } from '../whatsapp/panel/useAudioRecorder';

const LocationMap = dynamic(() => import('../whatsapp/LocationMap'), { 
  ssr: false, 
  loading: () => <div className="p-4 text-center text-xs text-gray-400">Carregando mapa...</div> 
});

const getDateLabel = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const today = new Date();
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  const diffDays = differenceInCalendarDays(today, date);
  if (diffDays === 2) return 'Anteontem';
  return format(date, 'dd/MM/yyyy');
};

const renderMessageContent = (msg, isMine) => {
  const content = msg.conteudo;
  
  if (!content) return null;

  // 📍 1. Localização (Mapa)
  if (content.startsWith('📍 Localização:') || content.startsWith('Localização:')) {
    try {
      const coords = content.split(':')[1].trim().split(',');
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return (
          <div className="rounded overflow-hidden my-1 border border-gray-100 min-w-[260px] shadow-inner bg-white text-gray-800 pointer-events-auto">
            <div className="h-36 w-full relative z-0">
              <LocationMap position={[lat, lng]} />
            </div>
            <div className="p-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
              <span className="text-[10px] font-bold text-gray-600">Localização Recebida</span>
              <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                 className="text-blue-600 text-[10px] font-bold flex items-center gap-1 hover:underline select-none"
              >
                ABRIR MAPA
              </a>
            </div>
          </div>
        );
      }
    } catch (e) {
      console.error("Erro ao fazer parse de localização no chat:", e);
    }
  }

  // Se for uma URL (HTTP/HTTPS)
  if (content.startsWith('http://') || content.startsWith('https://')) {
    const lowerContent = content.toLowerCase();
    const urlParts = content.split('/');
    const fileName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);

    // 🖼️ 2. Imagens
    if (/\.(jpg|jpeg|png|webp|gif|svg)/i.test(lowerContent)) {
      return (
        <div className="my-1 rounded-lg overflow-hidden border border-black/5 bg-gray-100 cursor-pointer max-w-full">
          <a href={content} target="_blank" rel="noopener noreferrer">
            <img src={content} alt="Imagem" className="max-w-full max-h-60 object-cover hover:opacity-95 transition-opacity" />
          </a>
        </div>
      );
    }

    // 🎥 3. Vídeos
    if (/\.(mp4|webm|mov|ogg)/i.test(lowerContent)) {
      return (
        <div className="my-1 rounded-lg overflow-hidden border border-black/5 bg-black max-w-full">
          <video src={content} controls className="max-w-full max-h-60" />
        </div>
      );
    }

    // 🎙️ 4. Áudios (Mensagem de Voz)
    if (/\.(mp3|wav|ogg|audio)/i.test(lowerContent) || content.includes('/audio_')) {
      const isMyMessage = isMine; // evita conflito de contexto
      return (
        <div className="my-1 flex items-center gap-2 p-1.5 rounded-lg border border-black/5 bg-black/5 min-w-[200px] text-gray-800">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMyMessage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            <FontAwesomeIcon icon={faHeadphones} className="text-xs" />
          </div>
          <audio controls src={content} className="h-8 max-w-[170px]" />
        </div>
      );
    }

    // 📄 5. Documentos
    return (
      <a href={content} target="_blank" rel="noopener noreferrer" 
         className="my-1 flex items-center gap-3 p-3 bg-black/5 hover:bg-black/10 rounded-lg transition-colors no-underline text-current"
      >
        <FontAwesomeIcon icon={faFileAlt} className="text-red-500 text-2xl shrink-0" />
        <div className="overflow-hidden flex-1 text-left min-w-0 pr-1">
          <p className="font-semibold text-[13px] truncate leading-tight">{fileName || "Documento"}</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">Download</span>
        </div>
        <FontAwesomeIcon icon={faDownload} className="text-gray-400 text-sm shrink-0" />
      </a>
    );
  }

  // 📝 6. Mensagem de Texto Comum
  return <span>{content}</span>;
};

export default function ChatRoom({ contact }) {
 const { user } = useAuth();
 const [newMessage, setNewMessage] = useState('');
 const [originalMessage, setOriginalMessage] = useState(null);
 const messagesEndRef = useRef(null);

 const supabase = createClient();
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Hook do Whatsapp adaptado para o novo bucket exclusivo
  const handleSendAudio = async ({ file }) => {
    if (!conversationId) return;
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = `chat-interno/${conversationId}/${Date.now()}_${cleanName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-interno')
        .upload(filePath, file, { contentType: file.type });
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('chat-interno')
        .getPublicUrl(filePath);
        
      sendMessageMutation.mutate({
        conversationId,
        senderId: user.id,
        conteudo: urlData.publicUrl
      });
    } catch (e) {
      toast.error("Erro ao enviar áudio: " + e.message);
    }
  };

  const {
    isRecording,
    recordingTime,
    isProcessing: isAudioProcessing,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder(handleSendAudio);

  // Compartilhamento de localização via API Geolocation nativa
  const handleSendLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      return;
    }
    
    toast.info("Obtendo sua localização atual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendMessageMutation.mutate({
          conversationId,
          senderId: user.id,
          conteudo: `📍 Localização: ${latitude}, ${longitude}`
        });
      },
      (error) => {
        console.error(error);
        toast.error("Não foi possível obter sua localização. Verifique as permissões do navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Upload direto para o bucket exclusivo chat-interno
  const handleFileUpload = async (e) => {
    setShowAttachMenu(false);
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 50MB.");
      return;
    }

    setIsUploading(true);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = `chat-interno/${conversationId}/${Date.now()}_${cleanName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-interno')
        .upload(filePath, file, { contentType: file.type });
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('chat-interno')
        .getPublicUrl(filePath);
        
      sendMessageMutation.mutate({
        conversationId,
        senderId: user.id,
        conteudo: urlData.publicUrl
      });
      toast.success("Arquivo enviado com sucesso!");
    } catch (e) {
      toast.error("Erro ao enviar arquivo: " + e.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

 const aiMutation = useMutation({
 mutationFn: async (text) => {
 const res = await fetch('/api/ai/chat-suggestion', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ text }),
 });
 if (!res.ok) {
 const error = await res.json();
 throw new Error(error.error || "Falha na IA");
 }
 return res.json();
 },
 onSuccess: (data) => {
 setOriginalMessage(newMessage); // guarda original
 setNewMessage(data.conteudo); // substitui pelo magic
 },
 onError: (err) => {
 toast.error('Erro ao corrigir: ' + err.message);
 }
 });

 const handleAIMagic = () => {
 if (!newMessage.trim() || aiMutation.isPending) return;
 aiMutation.mutate(newMessage);
 };

 // Hooks Padrão Ouro para comunicação Realtime
 const targetUserId = contact.isBroadcast ? null : contact.id; const { data: conversationId, isLoading: loadingConv } = useConversation(targetUserId);
 const { data: messages = [], isLoading: loadingMsgs } = useChatMessages(conversationId);
 const sendMessageMutation = useSendMessage();
 const markAsReadMutation = useMarkAsRead();

 const scrollToBottom = () => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 };

 useEffect(() => {
 scrollToBottom();
 // Verifica se eu recebi mensagens e elas não estão lidas ainda, avisa o servidor que eu vi!
 if (messages.length > 0 && conversationId && user) {
 const hasUnread = messages.some(m => m.sender_id !== user.id && m.read_at === null);
 if (hasUnread) {
 markAsReadMutation.mutate({ conversationId, userId: user.id });
 }
 }
 }, [messages, conversationId, user, markAsReadMutation]);

 const handleSend = (e) => {
 e.preventDefault();
 // Tratar futuro Memorando
 if (contact.isBroadcast) {
 alert("A funcionalidade de Memorandos Múltiplos está na próxima fase!");
 return;
 }

 if (!newMessage.trim() || !conversationId) return;
 const texto = newMessage.trim();
 setNewMessage(''); // Limpa o input otimisticamente
 setOriginalMessage(null); // Zera o backup da IA
 sendMessageMutation.mutate({
 conversationId: conversationId,
 senderId: user.id,
 conteudo: texto
 }, {
 onError: (err) => {
 const det = err?.message || err?.details || String(err);
 alert("Falha do Servidor: " + det);
 setNewMessage(texto); // Traz a msg de volta pro input em caso de erro
 }
 });
 };

 if (loadingConv || loadingMsgs) {
 return (
 <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
 <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-gray-300 mb-3" />
 <p className="text-gray-400 text-sm">Validando chaves criptográficas da sala...</p>
 </div>
 );
 }

 return (
 <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden h-full">
 {/* Mensagens Historico */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {messages.length === 0 ? (
 <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
 Nenhuma mensagem trocada ainda. Mande o primeiro oi!
 </div>
 ) : (
  messages.map((msg, index) => {
  const isMine = msg.sender_id === user?.id;
  const messageDate = msg.created_at;
  const currentDateLabel = getDateLabel(messageDate);
  const prevMessage = messages[index - 1];
  const prevDateLabel = prevMessage ? getDateLabel(prevMessage.created_at) : null;
  const showDateSeparator = currentDateLabel !== prevDateLabel;

  return (
  <div key={msg.id} className="flex flex-col">
  {showDateSeparator && (
  <div className="flex justify-center my-3 sticky top-0 z-10 pointer-events-none">
  <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border border-blue-100 uppercase tracking-wide opacity-95">
  {currentDateLabel}
  </span>
  </div>
  )}
  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
  <div className={`px-4 py-2 max-w-[85%] rounded-2xl shadow-sm text-[14px] ${
  isMine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
  }`}
  >
  {renderMessageContent(msg, isMine)}
  </div>
  <span className="text-[10.5px] text-gray-400 mt-1 px-1 font-medium tracking-wide flex items-center justify-end gap-1">
  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
  {isMine && (
  <FontAwesomeIcon icon={faCheckDouble} className={msg.read_at ? "text-blue-500 text-[11px]" : "text-gray-400 text-[11px]"} />
  )}
  </span>
  </div>
  </div>
  );
  })
 )}
 <div ref={messagesEndRef} />
 </div>

  {/* Input de Envio estilo Elegante */}
  <div className="p-3 bg-white border-t border-gray-200 shrink-0 relative">
    
    {/* Inputs ocultos de Upload */}
    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
    <input type="file" ref={docInputRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" />

    {/* MENU DE ANEXOS FLUTUANTE */}
    {showAttachMenu && (
      <div className="absolute bottom-16 left-4 bg-white border border-gray-200 rounded-2xl shadow-xl p-2.5 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[150px]">
        <button type="button" onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
        >
          <FontAwesomeIcon icon={faImage} className="text-blue-500 text-sm w-4 shrink-0" />
          <span>Fotos e Vídeos</span>
        </button>
        <button type="button" onClick={() => { setShowAttachMenu(false); docInputRef.current?.click(); }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
        >
          <FontAwesomeIcon icon={faFileAlt} className="text-red-500 text-sm w-4 shrink-0" />
          <span>Documento</span>
        </button>
        <button type="button" onClick={handleSendLocation}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-left"
        >
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-green-500 text-sm w-4 shrink-0" />
          <span>Localização</span>
        </button>
      </div>
    )}

    {/* BOTÃO DESFAZER IA (Flutuante sobre o chat interno) */}
    {originalMessage && (
      <button type="button"
              onClick={() => { setNewMessage(originalMessage); setOriginalMessage(null); }}
              className="absolute -top-10 right-4 text-[11px] bg-red-100 text-red-600 px-3 py-1.5 rounded-full shadow border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1 z-30 font-bold"
      >
        <FontAwesomeIcon icon={faUndo} /> Desfazer Correção
      </button>
    )}

    {isUploading && (
      <div className="absolute -top-10 left-4 text-[11px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full shadow border border-blue-100 flex items-center gap-1.5 z-30 font-bold">
        <FontAwesomeIcon icon={faSpinner} spin /> Enviando arquivo...
      </div>
    )}

    {isAudioProcessing && (
      <div className="absolute -top-10 left-4 text-[11px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full shadow border border-indigo-100 flex items-center gap-1.5 z-30 font-bold">
        <FontAwesomeIcon icon={faSpinner} spin /> Processando áudio...
      </div>
    )}

    {isRecording ? (
      /* --- INTERFACE DE GRAVAÇÃO ATIVA --- */
      <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-2xl p-2 animate-pulse">
        <div className="flex items-center gap-2 px-3">
          <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
          <span className="text-xs font-bold text-red-600">
            Gravando: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={cancelRecording} title="Cancelar Gravação"
                  className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center transition-colors"
          >
            <FontAwesomeIcon icon={faTrash} className="text-sm" />
          </button>
          <button type="button" onClick={stopRecording} title="Enviar Áudio"
                  className="w-9 h-9 rounded-full bg-red-600 text-white hover:bg-red-700 flex items-center justify-center transition-colors font-bold"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs ml-[-1px]" />
          </button>
        </div>
      </div>
    ) : (
      /* --- INTERFACE DE ENTRADA PADRÃO --- */
      <form onSubmit={handleSend} className="flex items-end gap-2 bg-gray-100 rounded-2xl p-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-transparent focus-within:border-blue-300">
        
        {/* BOTÃO DE ANEXO (CLIPE) */}
        <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} disabled={contact.isBroadcast || !conversationId} title="Anexar Mídia"
                className="p-2.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-transform active:scale-95 mb-0.5 shrink-0"
        >
          <FontAwesomeIcon icon={faPaperclip} className="text-[17px] rotate-45" />
        </button>

        <textarea value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); if(showAttachMenu) setShowAttachMenu(false); }}
                  placeholder={contact.isBroadcast ? "Em breve..." : "Digite sua mensagem..."}
                  disabled={contact.isBroadcast || !conversationId}
                  className="flex-1 max-h-32 min-h-[38px] bg-transparent resize-none outline-none text-[15px] px-2 py-2 text-gray-800 placeholder-gray-400 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
        />

        {/* BOTÃO MAGIA IA */}
        {newMessage.trim() && (
          <button type="button" onClick={handleAIMagic} disabled={aiMutation.isPending} title="Corrigir Gramática (IA)"
                  className="p-3 text-indigo-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:scale-100 transition-transform hover:scale-110 active:scale-95 mb-0.5 shrink-0"
          >
            {aiMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={faWandMagicSparkles} size="lg" />}
          </button>
        )}

        {/* BOTÃO DE ENVIAR (SE TIVER TEXTO) OU MICROFONE (SE ESTIVER VAZIO) */}
        {newMessage.trim() ? (
          <button type="submit" disabled={contact.isBroadcast}
                  className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-[14px] ml-[-2px]" />
          </button>
        ) : (
          <button type="button" onClick={startRecording} disabled={contact.isBroadcast || !conversationId} title="Gravar Mensagem de Voz"
                  className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 font-bold"
          >
            <FontAwesomeIcon icon={faMicrophone} className="text-[15px]" />
          </button>
        )}
      </form>
    )}
  </div>
 </div>
 );
}
