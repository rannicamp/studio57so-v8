'use client';
 
import dynamic from 'next/dynamic';
import React, { useRef } from 'react';
import '@photo-sphere-viewer/core/index.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
 
// Importa o visualizador 360 desabilitando a renderização no servidor (SSR)
// Isso é vital porque a biblioteca precisa acessar a "window" e o "document" do navegador.
const ReactPhotoSphereViewer = dynamic(
  () =>
    import('react-photo-sphere-viewer').then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-2xl border border-white/10">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-[#f25a2f] mb-2" />
        <p className="text-gray-400 font-medium">Carregando visão 360º...</p>
      </div>
    ),
  }
);
 
export default function Viewer360({ src }) {
  const psvRef = useRef(null);
 
  const handleReady = (instance) => {
    psvRef.current = instance;
  };
 
  return (
    <div className="relative w-full h-[400px] md:h-[600px] rounded-2xl overflow-hidden shadow-2xl border-4 border-zinc-900 group">
      {/* Overlay que some ao interagir, para dar aquele charme */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-6 opacity-100 transition-opacity duration-500 group-hover:opacity-0">
         <p className="text-white text-lg font-bold drop-shadow-md">
           Arraste para explorar o ambiente 360º
         </p>
         <p className="text-gray-400 text-xs mt-1">
           Toque e arraste para navegar em todas as direções.
         </p>
      </div>
      
      <ReactPhotoSphereViewer
        src={src}
        height="100%"
        width="100%"
        onReady={handleReady}
        littlePlanet={false}
        defaultZoomLvl={10}
        touchmoveTwoFingers={true}
        mousewheelCtrlKey={true}
      />
    </div>
  );
}
