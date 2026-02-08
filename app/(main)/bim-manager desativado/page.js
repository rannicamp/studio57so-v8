// Caminho: app/(main)/bim-manager/page.js
'use client';

import { useState, useEffect } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimContent from '@/components/bim/BimContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFileDownload, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

export default function BimManagerPage() {
  const [selectedContext, setSelectedContext] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null); 

  useEffect(() => {
    // Restaurar estado ao carregar
    const savedUrn = localStorage.getItem('studio57_last_bim_urn');
    if (savedUrn) setActiveUrn(savedUrn);
  }, []);

  const handleContextSelect = (context) => {
    setSelectedContext(context);
    setActiveUrn(null); // Fecha o visualizador ao mudar de pasta para ver a lista
  };

  const handleFileSelect = (urn) => {
      if (!urn) return;
      setActiveUrn(urn);
      localStorage.setItem('studio57_last_bim_urn', urn);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      
      <BimSidebar 
        onSelectContext={handleContextSelect} 
        onFileSelect={handleFileSelect}
        selectedContext={selectedContext} 
        activeUrn={activeUrn}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Botão Flutuante de Voltar (Sobre o Viewer) */}
        {activeUrn && (
            <div className="absolute top-4 left-4 z-50 animate-fade-in">
                <button 
                    onClick={() => setActiveUrn(null)}
                    className="bg-white/90 backdrop-blur shadow-lg border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-white hover:text-blue-600 transition-all flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faChevronLeft} /> LISTA DE ARQUIVOS
                </button>
            </div>
        )}

        <BimContent 
            context={selectedContext} 
            onFileSelect={handleFileSelect}
            activeFileUrn={activeUrn}
        />
      </main>

      {/* Sidebar Direita (Propriedades) */}
      {activeUrn && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-40">
              <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase text-gray-500">Propriedades</h3>
                  <button onClick={() => setActiveUrn(null)} className="text-gray-400 hover:text-red-500">
                      <FontAwesomeIcon icon={faTimes} />
                  </button>
              </div>
              <div className="flex-1 p-4">
                  <p className="text-xs text-gray-400 text-center mt-10">Selecione um elemento no 3D para ver detalhes.</p>
              </div>
          </aside>
      )}
    </div>
  );
}