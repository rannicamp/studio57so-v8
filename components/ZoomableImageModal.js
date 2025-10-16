// components/ZoomableImageModal.js
'use client';

import React from 'react';
import Image from 'next/image';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faExpand, faXmark } from '@fortawesome/free-solid-svg-icons';

const ZoomableImageModal = ({ imageUrl, isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Fechar */}
        <button
          className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors z-20 shadow-lg"
          onClick={onClose}
          aria-label="Fechar mapa"
        >
          <FontAwesomeIcon icon={faXmark} size="lg" />
        </button>

        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={8}
          limitToBounds={true}
          doubleClick={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controles de Zoom */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/20 backdrop-blur-sm p-2 rounded-full z-20 shadow-lg">
                <button onClick={() => zoomIn()} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors">
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                <button onClick={() => zoomOut()} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors">
                  <FontAwesomeIcon icon={faMinus} />
                </button>
                <button onClick={() => resetTransform()} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors">
                  <FontAwesomeIcon icon={faExpand} />
                </button>
              </div>

              {/* O Componente que torna a imagem interativa */}
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                        src={imageUrl}
                        alt="Mapa do empreendimento Refúgio Braúnas"
                        width={1200}
                        height={800}
                        className="max-w-none max-h-none object-contain"
                        style={{ width: 'auto', height: 'auto', maxHeight: '90vh', maxWidth: '90vw' }}
                    />
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
};

export default ZoomableImageModal;