// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimContent from '@/components/bim/BimContent';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronLeft, faHome, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

export default function BimManagerPage() {
  const [selectedContext, setSelectedContext] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null); 
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  // Persistência
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedUrn = localStorage.getItem('studio57_last_bim_urn');
        const savedContext = localStorage.getItem('studio57_last_bim_context');
        
        if (savedUrn) setActiveUrn(savedUrn);
        if (savedContext) {
            try { setSelectedContext(JSON.parse(savedContext)); } catch (e) {}
        }
    }
  }, []);

  const handleContextSelect = (context) => {
    setSelectedContext(context);
    localStorage.setItem('studio57_last_bim_context', JSON.stringify(context));
    setIsViewerVisible(false); 
  };

  const handleFileSelect = (urn) => {
      if (!urn) return;
      setActiveUrn(urn);
      setIsViewerVisible(true);
      localStorage.setItem('studio57_last_bim_urn', urn);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 relative">
      
      {/* HEADER FLUTUANTE (Para sair do modo imersivo) */}
      <div className="absolute top-0 right-0 p-4 z-[60] flex gap-2">
        <Link 
            href="/dashboard" 
            className="bg-white hover:bg-gray-100 text-gray-700 p-2.5 rounded-lg shadow-md border border-gray-200 transition-all flex items-center gap-2 text-xs font-bold"
            title="Voltar ao Sistema Principal"
        >
            <FontAwesomeIcon icon={faHome} /> <span className="hidden md:inline">SISTEMA</span>
        </Link>
      </div>

      {/* === CAMADA 0: O VISUALIZADOR === */}
      <div 
        className="absolute inset-0 z-0 bg-gray-100"
        style={{ 
            visibility: isViewerVisible ? 'visible' : 'hidden', 
            zIndex: isViewerVisible ? 50 : 0 
        }}
      >
          {activeUrn && <AutodeskViewerAPI urn={activeUrn} />}
          
          {/* Botão Flutuante 'Voltar' dentro do Viewer */}
          <div className="absolute top-4 left-4 z-50">
                <button 
                    onClick={() => setIsViewerVisible(false)}
                    className="bg-white/90 backdrop-blur shadow-lg border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-white flex items-center gap-2 transition-all active:scale-95"
                >
                    <FontAwesomeIcon icon={faChevronLeft} /> EXPLORADOR DE ARQUIVOS
                </button>
          </div>
      </div>

      {/* === CAMADA 1: A NAVEGAÇÃO (Sidebar + Content) === */}
      
      {/* Sidebar - Usando o componente que já criamos */}
      <BimSidebar 
        onSelectContext={handleContextSelect} 
        onFileSelect={handleFileSelect}
        selectedContext={selectedContext} 
        activeUrn={activeUrn}
      />

      {/* Content - Área de lista */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-gray-50">
        <BimContent 
            context={selectedContext} 
            onFileSelect={handleFileSelect}
        />
      </main>

      {/* Sidebar Direita (Propriedades) - Opcional */}
      {isViewerVisible && activeUrn && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-50 animate-slide-in-right hidden md:flex">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-xs uppercase text-gray-500">Propriedades</h3>
                  <button onClick={() => setIsViewerVisible(false)} className="text-gray-400 hover:text-red-500">
                      <FontAwesomeIcon icon={faTimes} />
                  </button>
              </div>
              <div className="flex-1 p-6 text-xs text-gray-500 text-center flex flex-col items-center justify-center">
                  <p>Selecione um objeto no modelo para ver detalhes.</p>
              </div>
          </aside>
      )}
    </div>
  );
}