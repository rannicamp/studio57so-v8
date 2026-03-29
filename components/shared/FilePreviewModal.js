"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilePdf, faDownload, faSpinner, faExpand, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

export default function FilePreviewModal({ anexo, onClose }) {
    const [isLoading, setIsLoading] = useState(true);

    if (!anexo) return null;

    const ext = anexo.nome_arquivo?.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] transition-opacity" 
                onClick={onClose} 
            />

            <div
                className="fixed top-0 right-0 h-full w-full lg:w-[800px] xl:w-[1000px] bg-gray-900 shadow-2xl z-[120] flex flex-col border-l border-gray-700 transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right"
            >
                <div className="flex justify-between items-center p-3 bg-gray-800 text-white border-b border-gray-700 shadow-md shrink-0">
                    <h3 className="text-sm font-semibold truncate flex items-center gap-2">
                        <FontAwesomeIcon icon={isPdf ? faFilePdf : faFileLines} />
                        {anexo.nome_arquivo}
                    </h3>
                    <div className="flex gap-2 items-center">
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Abrir numa nova aba">
                            <FontAwesomeIcon icon={faExpand} />
                        </a>
                        <a href={anexo.public_url} download={anexo.nome_arquivo} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Baixar">
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                        <button onClick={onClose} className="p-1.5 hover:bg-red-600 rounded text-gray-400 hover:text-white transition-colors ml-2" title="Fechar">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-800 flex items-center justify-center overflow-hidden relative">
                    {isLoading && !isVideo && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 z-10">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-4xl mb-3" />
                        </div>
                    )}

                    {isPdf ? (
                        <iframe 
                            src={`${anexo.public_url}#toolbar=0`} 
                            className="w-full h-full border-none bg-white" 
                            title="PDF Preview" 
                            onLoad={() => setIsLoading(false)}
                        />
                    ) : isImage ? (
                        <img 
                            src={anexo.public_url} 
                            alt="Preview" 
                            className={`max-w-full max-h-full object-contain shadow-lg transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`} 
                            onLoad={() => setIsLoading(false)}
                        />
                    ) : isVideo ? (
                        <video
                            src={anexo.public_url}
                            className="max-w-full max-h-full rounded shadow-lg"
                            controls
                            autoPlay
                            onLoadedData={() => setIsLoading(false)}
                        />
                    ) : (
                        <div className="text-center text-gray-400 p-8">
                            <p className="mb-4 text-lg">Visualização não suportada para este formato.</p>
                            <a href={anexo.public_url} download className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">Baixar Arquivo ({ext})</a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
