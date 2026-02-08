// Caminho: app/components/bim/AutodeskViewer.js
'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faSpinner, faExpand } from '@fortawesome/free-solid-svg-icons';

export default function AutodeskViewer({ url, titulo = "Visualizador BIM" }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col h-full">
      
      {/* Barra de Título Técnica */}
      <div className="bg-black text-white px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-1.5 rounded">
                <FontAwesomeIcon icon={faCube} className="text-white text-sm" />
            </div>
            <div>
                <h3 className="font-bold text-sm tracking-wide uppercase text-gray-200">{titulo}</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Studio 57 Engineering</p>
            </div>
        </div>
        <div className="text-xs text-gray-500 font-mono">
            A360 EMBED
        </div>
      </div>

      {/* Área do Viewer */}
      <div className="relative w-full h-[600px] md:h-[80vh] bg-gray-800">
        
        {/* Loading State (Spinner) */}
        {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900/80 backdrop-blur-sm text-white">
                <FontAwesomeIcon icon={faSpinner} className="text-5xl text-orange-500 animate-spin mb-4" />
                <p className="text-gray-300 font-light tracking-widest text-sm animate-pulse">CARREGANDO MODELO 3D...</p>
            </div>
        )}

        <iframe 
            src={url} 
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen={true} 
            webkitallowfullscreen="true" 
            mozallowfullscreen="true"
            onLoad={() => setIsLoading(false)}
        ></iframe>
        
      </div>
      
      {/* Rodapé de Controle */}
      <div className="bg-gray-900 p-3 text-center border-t border-gray-800 flex justify-between items-center px-6">
        <p className="text-[10px] text-gray-500 font-mono">
            SERVER: AUTODESK CLOUD • RENDER: WEBGL
        </p>
        <p className="text-xs text-orange-500 font-bold">
            Interativo
        </p>
      </div>
    </div>
  );
}