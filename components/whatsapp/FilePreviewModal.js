'use client';

import { Dialog } from '@headlessui/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faFilePdf, faFileWord, faFileExcel, faFileAlt, faMusic, faVideo } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';

export default function FilePreviewModal({ isOpen, onClose, file, onSend }) {
    const [caption, setCaption] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);

    // Gera a prévia do arquivo quando o arquivo muda
    useEffect(() => {
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            setCaption(''); // Reseta legenda

            // Limpeza de memória
            return () => URL.revokeObjectURL(objectUrl);
        }
    }, [file]);

    if (!file) return null;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    // Ícone baseado no tipo
    const getFileIcon = () => {
        if (file.type.includes('pdf')) return faFilePdf;
        if (file.type.includes('word') || file.type.includes('doc')) return faFileWord;
        if (file.type.includes('sheet') || file.type.includes('excel')) return faFileExcel;
        if (isAudio) return faMusic;
        if (isVideo) return faVideo;
        return faFileAlt;
    };

    const handleSend = () => {
        onSend(file, caption);
        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            {/* Background escuro */}
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#efeae2] shadow-xl transition-all flex flex-col max-h-[90vh]">
                    
                    {/* Cabeçalho */}
                    <div className="bg-[#00a884] p-3 flex justify-between items-center text-white">
                        <Dialog.Title className="font-medium">Enviar Arquivo</Dialog.Title>
                        <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 w-8 h-8 flex items-center justify-center transition-colors">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    {/* Área de Visualização */}
                    <div className="flex-grow p-6 flex flex-col items-center justify-center bg-[#e9edef] overflow-y-auto">
                        {isImage ? (
                            <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg shadow-md object-contain" />
                        ) : isVideo ? (
                            <video src={previewUrl} controls className="max-h-64 rounded-lg shadow-md w-full" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-500 gap-4 py-8">
                                <FontAwesomeIcon icon={getFileIcon()} size="5x" className="text-gray-400" />
                                <span className="font-medium text-gray-700 text-center break-all px-4">{file.name}</span>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        )}
                    </div>

                    {/* Rodapé com Legenda e Enviar */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <input
                            type="text"
                            placeholder="Adicione uma legenda..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            autoFocus
                            className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#00a884] mb-3 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSend}
                                className="flex items-center gap-2 px-6 py-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] shadow-sm transition-all text-sm font-medium"
                            >
                                <FontAwesomeIcon icon={faPaperPlane} />
                                Enviar
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}