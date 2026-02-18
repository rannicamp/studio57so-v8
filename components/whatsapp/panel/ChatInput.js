'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPaperclip, faFileLines, faMicrophone, faPaperPlane, 
    faSmile, faTimes, faStop, faImage, faMapMarkerAlt,
    faTrash, faCheck 
} from '@fortawesome/free-solid-svg-icons';

export default function ChatInput({ 
    newMessage, setNewMessage, onSendMessage, 
    onOpenUploader, onOpenTemplate, onOpenLocation, 
    recorder, uploadingOrProcessing, onPasteFile
}) {
    const textareaRef = useRef(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // Ajusta altura do textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [newMessage]);

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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage(e);
        }
    };

    // --- LÓGICA DE GRAVAÇÃO ---

    const startRecording = () => {
        recorder.startRecording();
        setIsRecording(true);
    };

    const cancelRecording = () => {
        recorder.cancelRecording(); // Chama a função que descarta o áudio
        setIsRecording(false);
    };

    const finishRecording = () => {
        recorder.stopRecording(); // Chama a função que processa e envia
        setIsRecording(false);
    };

    // --------------------------

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
                        <button 
                            onClick={cancelRecording}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Cancelar gravação"
                        >
                            <FontAwesomeIcon icon={faTrash} size="lg" />
                        </button>

                        {/* BOTÃO ENVIAR (CHECK) */}
                        <button 
                            onClick={finishRecording}
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
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                            className={`p-3 rounded-full transition-colors mb-1 ${isMenuOpen ? 'bg-gray-200 text-gray-600' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            <FontAwesomeIcon icon={isMenuOpen ? faTimes : faPaperclip} size="lg" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute bottom-14 left-0 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
                                <button 
                                    onClick={() => { onOpenUploader(); setIsMenuOpen(false); }}
                                    className="w-12 h-12 rounded-full bg-gradient-to-t from-purple-500 to-purple-400 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                                    title="Imagem/Vídeo"
                                >
                                    <FontAwesomeIcon icon={faImage} />
                                </button>
                                
                                <button 
                                    onClick={() => { onOpenTemplate(); setIsMenuOpen(false); }}
                                    className="w-12 h-12 rounded-full bg-gradient-to-t from-blue-500 to-blue-400 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                                    title="Template"
                                >
                                    <FontAwesomeIcon icon={faFileLines} />
                                </button>

                                <button 
                                    onClick={() => { onOpenLocation(); setIsMenuOpen(false); }}
                                    className="w-12 h-12 rounded-full bg-gradient-to-t from-green-500 to-green-400 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                                    title="Localização"
                                >
                                    <FontAwesomeIcon icon={faMapMarkerAlt} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* INPUT DE TEXTO */}
                    <div className="flex-grow bg-white rounded-lg border border-gray-300 flex items-end py-2 px-4 shadow-sm focus-within:ring-2 focus-within:ring-[#00a884]/50 focus-within:border-[#00a884] transition-all">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite uma mensagem"
                            className="w-full max-h-[120px] resize-none outline-none text-gray-700 bg-transparent custom-scrollbar leading-6"
                            rows={1}
                        />
                        <button className="text-gray-400 hover:text-gray-600 mb-1 ml-2">
                            <FontAwesomeIcon icon={faSmile} size="lg" />
                        </button>
                    </div>

                    {/* BOTÃO ENVIAR OU MICROFONE */}
                    {newMessage.trim() ? (
                        <button 
                            onClick={onSendMessage} 
                            disabled={uploadingOrProcessing}
                            className="p-3 bg-[#00a884] text-white rounded-full shadow-md hover:bg-[#008f6f] transition-all mb-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    ) : (
                        <button 
                            onClick={startRecording}
                            className="p-3 bg-[#f0f2f5] text-gray-500 hover:bg-gray-200 rounded-full shadow-md transition-all mb-1"
                        >
                            <FontAwesomeIcon icon={faMicrophone} />
                        </button>
                    )}
                </>
            )}
        </div>
    );
}