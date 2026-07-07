// components/whatsapp/panel/ChatInput.js
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faFileLines, faMicrophone, faPaperPlane, faSmile, faTimes, faStop, faImage, faMapMarkerAlt, faLock,
 faTrash, faCheck, faWandMagicSparkles, faUndo, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

function ChatInput({ 
  newMessage, 
  setNewMessage, 
  onSendMessage, 
  onOpenUploader, 
  onOpenTemplate, 
  onOpenLocation, 
  recorder, 
  uploadingOrProcessing, 
  onPasteFile, 
  isWindowOpen,
  contact
}) {
  const textareaRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [originalMessage, setOriginalMessage] = useState(null);
  const [localText, setLocalText] = useState(newMessage || '');
  const [isSending, setIsSending] = useState(false);

  // Sincroniza localText quando o contato muda ou quando o rascunho de fora é redefinido
  useEffect(() => {
    setLocalText(newMessage || '');
  }, [contact?.contato_id, newMessage]);

  // Salva o rascunho no localStorage do pai de forma debotada (1s de inatividade na digitação)
  useEffect(() => {
    if (localText === newMessage) return;
    const handler = setTimeout(() => {
      setNewMessage(localText);
    }, 1000);

    return () => clearTimeout(handler);
  }, [localText, setNewMessage, newMessage]);

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
      setOriginalMessage(localText);
      setLocalText(data.conteudo);
      setNewMessage(data.conteudo);
    },
    onError: (err) => {
      toast.error('Erro ao corrigir: ' + err.message);
    }
  });

  const handleAIMagic = () => {
    if (!localText.trim() || aiMutation.isPending) return;
    aiMutation.mutate(localText);
  };

  // Ajusta altura do textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [localText]);

  // Cola arquivos
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData.files.length > 0) {
        onPasteFile(e.clipboardData.files[0]);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onPasteFile]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    const closeMenu = () => setIsMenuOpen(false);
    if (isMenuOpen) document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [isMenuOpen]);

  // Submissão da mensagem de forma assíncrona com bloqueio de cliques duplos
  const handleSendAndLock = async (e) => {
    if (e) e.preventDefault();
    if (!localText.trim() || isSending || uploadingOrProcessing) return;

    setIsSending(true);
    try {
      await onSendMessage(localText);
      setLocalText('');
      setNewMessage('');
      setOriginalMessage(null);
    } catch (err) {
      console.error("[ChatInput Error] Erro ao enviar mensagem:", err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAndLock(e);
    }
  };

  // --- LÓGICA DE GRAVAÇÃO ---
  const startRecording = () => {
    recorder.startRecording();
    setIsRecording(true);
  };

  const cancelRecording = () => {
    recorder.cancelRecording();
    setIsRecording(false);
  };

  const finishRecording = () => {
    recorder.stopRecording();
    setIsRecording(false);
  };

  return (
    <div className="bg-[#f0f2f5] px-4 py-2 flex items-end gap-2 relative z-20">
      {/* Se estiver gravando, mostramos uma interface diferente */}
      {isRecording ? (
        <div className="flex-grow flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm border border-red-200 animate-pulse">
          <span className="text-red-500 font-medium flex items-center gap-2">
            <FontAwesomeIcon icon={faMicrophone} className="animate-bounce" />
            Gravando áudio...
          </span>
          <div className="flex items-center gap-3">
            {/* BOTÃO CANCELAR (LIXEIRA) */}
            <button onClick={cancelRecording}
              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Cancelar gravação"
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </button>

            {/* BOTÃO ENVIAR (CHECK) */}
            <button onClick={finishRecording}
              className="p-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] shadow-md transition-transform hover:scale-105"
              title="Enviar áudio"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
          </div>
        </div>
      ) : (
        /* INTERFACE NORMAL DE TEXTO */
        <>
          {/* MENU DE ANEXOS */}
          <div className="relative">
            <button type="button"
              disabled={isSending}
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className={`p-3 rounded-full transition-colors mb-1 ${isMenuOpen ? 'bg-gray-200 text-gray-600' : 'text-gray-500 hover:bg-gray-200'} disabled:opacity-50`}
            >
              <FontAwesomeIcon icon={isMenuOpen ? faTimes : faPaperclip} size="lg" />
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-14 left-0 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <button onClick={() => { onOpenUploader(); setIsMenuOpen(false); }}
                  className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                  title="Imagem/Vídeo"
                >
                  <FontAwesomeIcon icon={faImage} />
                </button>
                <button onClick={() => { onOpenTemplate(); setIsMenuOpen(false); }}
                  className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                  title="Template"
                >
                  <FontAwesomeIcon icon={faFileLines} />
                </button>

                <button onClick={() => { onOpenLocation(); setIsMenuOpen(false); }}
                  className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                  title="Localização"
                >
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                </button>
              </div>
            )}
          </div>

          {/* INPUT DE TEXTO OU BLOQUEIO DE JANELA */}
          {!isWindowOpen ? (
            <div className="flex-grow bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-between py-2 px-4 shadow-sm opacity-80 mt-1">
              <div className="flex items-center gap-3 text-gray-500">
                <FontAwesomeIcon icon={faLock} />
                <span className="text-sm font-medium">Janela Fechada (24h)</span>
              </div>
              <button onClick={() => onOpenTemplate()} disabled={isSending} className="text-sm bg-[#00a884] text-white px-4 py-1.5 rounded shadow-sm hover:bg-[#008f6f] transition-colors flex items-center gap-2 disabled:opacity-50">
                <FontAwesomeIcon icon={faFileLines} /> Enviar Modelo
              </button>
            </div>
          ) : (
            <>
              <div className="flex-grow bg-white rounded-lg border border-gray-300 flex items-end py-2 px-4 shadow-sm focus-within:ring-2 focus-within:ring-[#00a884]/50 focus-within:border-[#00a884] transition-all">
                <textarea
                  ref={textareaRef}
                  value={localText}
                  onChange={(e) => setLocalText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                  placeholder="Digite uma mensagem"
                  className="w-full max-h-[120px] resize-none outline-none text-gray-700 bg-transparent custom-scrollbar leading-6 disabled:opacity-50"
                  rows={1}
                />
                <button type="button" disabled={isSending} className="text-gray-400 hover:text-gray-600 mb-1 ml-2 disabled:opacity-55">
                  <FontAwesomeIcon icon={faSmile} size="lg" />
                </button>
              </div>

              {/* BOTÃO DESFAZER IA (Flutuante) */}
              {originalMessage && (
                <button type="button"
                  disabled={isSending}
                  onClick={() => { setLocalText(originalMessage); setOriginalMessage(null); }}
                  className="absolute -top-7 right-4 text-[12px] bg-red-100 text-red-600 px-3 py-1 rounded-full shadow border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1 z-30 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faUndo} /> Desfazer Correção
                </button>
              )}

              {/* BOTÃO MAGIA IA */}
              <button type="button" onClick={handleAIMagic} disabled={!localText.trim() || aiMutation.isPending || isSending} title="Corrigir Gramática (IA)"
                className="p-3 text-indigo-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:scale-100 transition-transform hover:scale-110 active:scale-95 mb-1"
              >
                {aiMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={faWandMagicSparkles} size="lg" />}
              </button>

              {/* BOTÃO ENVIAR OU MICROFONE */}
              {localText.trim() ? (
                <button onClick={handleSendAndLock} disabled={uploadingOrProcessing || isSending}
                  className="p-3 bg-[#00a884] text-white rounded-full shadow-md hover:bg-[#008f6f] transition-all mb-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                </button>
              ) : (
                <button onClick={startRecording} disabled={isSending}
                  className="p-3 bg-[#f0f2f5] text-gray-500 hover:bg-gray-200 rounded-full shadow-md transition-all mb-1 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(ChatInput);