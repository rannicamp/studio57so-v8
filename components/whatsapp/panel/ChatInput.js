'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faFileLines, faMicrophone, faSpinner, faPaperPlane, faTrash, faStop } from '@fortawesome/free-solid-svg-icons';

export default function ChatInput({ 
    newMessage, 
    setNewMessage, 
    onSendMessage, 
    onOpenUploader, 
    onOpenTemplate, 
    recorder,
    uploadingOrProcessing,
    onPasteFile
}) {
    const textareaRef = useRef(null);

    // Formata o tempo do gravador
    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // Ajusta a altura automaticamente
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '24px'; // Reset para recalcular
            const scrollHeight = textarea.scrollHeight;
            // Limita a altura a 4 linhas (aproximadamente 96px)
            textarea.style.height = Math.min(scrollHeight, 96) + 'px';
        }
    }, [newMessage]);

    // Lógica para capturar Ctrl+V de arquivos
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file && onPasteFile) {
                    e.preventDefault();
                    onPasteFile(file);
                }
            }
        }
    };

    return (
        <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-2 z-20">
            {/* LÓGICA DE BOTÕES ESQUERDOS */}
            {recorder.isRecording ? (
                <button 
                    onClick={recorder.cancelRecording} 
                    className="text-red-500 hover:text-red-600 p-2 transition-transform hover:scale-110"
                    title="Cancelar gravação"
                >
                    <FontAwesomeIcon icon={faTrash} size="lg" />
                </button>
            ) : (
                <>
                    <button onClick={onOpenUploader} className="text-gray-500 hover:text-gray-700 p-2" disabled={uploadingOrProcessing}>
                        <FontAwesomeIcon icon={faPaperclip} size="lg" />
                    </button>
                    {!recorder.isProcessing && <button onClick={onOpenTemplate} className="text-gray-500 hover:text-gray-700 p-2"><FontAwesomeIcon icon={faFileLines} size="lg" /></button>}
                </>
            )}

            <div className="flex-grow bg-white rounded-lg border border-transparent flex items-center py-2 px-4 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
                {recorder.isRecording ? (
                    <div className="flex-grow flex items-center text-red-500 font-medium animate-pulse">
                        <span><FontAwesomeIcon icon={faMicrophone} className="mr-2" /> Gravando... {formatTime(recorder.recordingTime)}</span>
                    </div>
                ) : (recorder.isProcessing || uploadingOrProcessing) ? (
                    <div className="flex-grow flex items-center gap-2 text-gray-500 font-medium">
                        <FontAwesomeIcon icon={faSpinner} spin /> Processando...
                    </div>
                ) : (
                    <textarea 
                        ref={textareaRef}
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(e); } }} 
                        onPaste={handlePaste}
                        placeholder="Digite uma mensagem" 
                        className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-gray-700 custom-scrollbar p-0 placeholder-gray-400 overflow-y-auto" 
                        rows={1} 
                        style={{ minHeight: '24px', lineHeight: '24px' }} 
                    />
                )}
            </div>

            {newMessage.trim() ? (
                <button onClick={onSendMessage} disabled={uploadingOrProcessing} className="text-[#00a884] hover:text-[#008f6f] p-2">
                    {uploadingOrProcessing ? <FontAwesomeIcon icon={faSpinner} spin size="lg"/> : <FontAwesomeIcon icon={faPaperPlane} size="lg" />}
                </button>
            ) : (
                <button 
                    onClick={recorder.isRecording ? recorder.stopRecording : recorder.startRecording} 
                    disabled={recorder.isProcessing || uploadingOrProcessing} 
                    className={`p-2 ${recorder.isRecording ? 'text-green-500 hover:text-green-600 scale-110' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {recorder.isProcessing ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={recorder.isRecording ? faPaperPlane : faMicrophone} size="lg" />}
                </button>
            )}
        </div>
    );
}