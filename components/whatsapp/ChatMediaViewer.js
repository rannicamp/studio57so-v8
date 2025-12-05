'use client';

import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faExpand, faXmark, faDownload } from '@fortawesome/free-solid-svg-icons';

export default function ChatMediaViewer({ isOpen, onClose, mediaUrl, mediaType, fileName }) {
    if (!isOpen || !mediaUrl) return null;

    const isImage = mediaType === 'image';
    const isVideo = mediaType === 'video';

    return (
        <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 backdrop-blur-sm transition-all duration-300"
            onClick={onClose} // Fecha ao clicar no fundo preto
        >
            <div 
                className="relative w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()} // Evita fechar ao clicar na imagem
            >
                {/* --- BARRA DE FERRAMENTAS SUPERIOR --- */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
                    <span className="text-white text-sm font-medium truncate max-w-[70%] drop-shadow-md">
                        {fileName || 'Visualização de Mídia'}
                    </span>
                    <div className="flex items-center gap-4">
                        {/* Botão Download */}
                        <a href={mediaUrl} download={fileName || 'arquivo'} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Baixar Original">
                            <FontAwesomeIcon icon={faDownload} size="lg" />
                        </a>
                        {/* Botão Fechar */}
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-md"
                        >
                            <FontAwesomeIcon icon={faXmark} size="xl" />
                        </button>
                    </div>
                </div>

                {/* --- CONTEÚDO (IMAGEM COM ZOOM OU VÍDEO) --- */}
                <div className="flex-grow flex items-center justify-center w-full h-full overflow-hidden">
                    
                    {isImage && (
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={5}
                            centerOnInit={true}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <TransformComponent
                                        wrapperStyle={{ width: '100%', height: '100%' }}
                                        contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <img 
                                            src={mediaUrl} 
                                            alt="Visualização" 
                                            className="max-w-full max-h-[90vh] object-contain shadow-2xl"
                                            style={{ width: 'auto', height: 'auto' }}
                                        />
                                    </TransformComponent>

                                    {/* Controles de Zoom Flutuantes */}
                                    <div className="absolute bottom-8 flex gap-4 bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl z-50">
                                        <button onClick={() => zoomIn()} className="w-10 h-10 text-white hover:bg-white/20 rounded-full transition-colors flex items-center justify-center" title="Aumentar Zoom">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                        <button onClick={() => zoomOut()} className="w-10 h-10 text-white hover:bg-white/20 rounded-full transition-colors flex items-center justify-center" title="Diminuir Zoom">
                                            <FontAwesomeIcon icon={faMinus} />
                                        </button>
                                        <button onClick={() => resetTransform()} className="w-10 h-10 text-white hover:bg-white/20 rounded-full transition-colors flex items-center justify-center" title="Resetar">
                                            <FontAwesomeIcon icon={faExpand} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </TransformWrapper>
                    )}

                    {isVideo && (
                        <video 
                            src={mediaUrl} 
                            controls 
                            autoPlay 
                            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl outline-none"
                        />
                    )}
                    
                </div>
            </div>
        </div>
    );
}