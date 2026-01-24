// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimContent from '@/components/bim/BimContent';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome, faTimes } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

export default function BimManagerPage() {
  const [selectedContext, setSelectedContext] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null); 
  
  // Controle da Barra Lateral (Explorador)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Recupera estado salvo
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedUrn = localStorage.getItem('studio57_last_bim_urn');
        const savedContext = localStorage.getItem('studio57_last_bim_context');
        if (savedUrn) setActiveUrn(savedUrn);
        if (savedContext) try { setSelectedContext(JSON.parse(savedContext)); } catch (e) {}
    }
  }, []);

  const handleContextSelect = (context) => {
    setSelectedContext(context);
    localStorage.setItem('studio57_last_bim_context', JSON.stringify(context));
    // Quando seleciona uma pasta, se tiver um arquivo aberto, a gente fecha ele? 
    // Ou mantemos aberto? Pelo seu pedido, mantemos o explorer visível.
    // Mas se você mudou de pasta, talvez queira ver a lista.
    // Vamos manter o viewer aberto se já estiver, só mudamos o contexto da lista (que está oculta).
  };

  const handleFileSelect = (urn) => {
      if (!urn) return;
      setActiveUrn(urn);
      localStorage.setItem('studio57_last_bim_urn', urn);
  };

  const handleCloseViewer = () => {
      setActiveUrn(null);
      localStorage.removeItem('studio57_last_bim_urn');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50 relative">
      
      {/* 1. BARRA LATERAL (EXPLORADOR) - COLUNA ESQUERDA */}
      <div 
        className={`
            relative h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col
            ${isSidebarVisible ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
        `}
      >
         <BimSidebar 
            onSelectContext={handleContextSelect} 
            onFileSelect={handleFileSelect} // Permite abrir arquivo direto da árvore
            selectedContext={selectedContext} 
            activeUrn={activeUrn}
         />
      </div>

      {/* BOTÃO DE COLAPSAR/EXPANDIR (Fica na divisa) */}
      <button 
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        className={`
            absolute top-1/2 z-50 transform -translate-y-1/2 
            bg-white border border-gray-200 shadow-md text-gray-500 hover:text-blue-600
            w-6 h-12 flex items-center justify-center rounded-r-lg transition-all duration-300
            ${isSidebarVisible ? 'left-80' : 'left-0'}
        `}
        title={isSidebarVisible ? "Ocultar Explorador" : "Mostrar Explorador"}
      >
          <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} size="xs" />
      </button>


      {/* 2. ÁREA PRINCIPAL (DIREITA) */}
      <main className="flex-1 h-full relative bg-gray-100 flex flex-col min-w-0">
          
          {/* HEADER FLUTUANTE SIMPLES */}
          <div className="absolute top-4 right-4 z-[60] flex gap-2">
            <Link 
                href="/dashboard" 
                className="bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 backdrop-blur transition-all text-xs font-bold flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faHome} /> SISTEMA
            </Link>
          </div>

          {/* CAMADA A: O VISUALIZADOR (Fica no fundo, Z-0) */}
          <div className="absolute inset-0 z-0 bg-gray-200">
             {/* O Viewer sempre existe se houver URN. O ResizeObserver no componente cuida do tamanho. */}
             {activeUrn ? (
                 <AutodeskViewerAPI urn={activeUrn} />
             ) : (
                 /* Placeholder quando não tem nada aberto */
                 <div className="flex items-center justify-center h-full opacity-30">
                     <p className="font-black text-4xl text-gray-300 uppercase tracking-widest select-none">Studio 57 BIM</p>
                 </div>
             )}
          </div>

          {/* CAMADA B: A LISTA DE ARQUIVOS (BimContent) (Fica na frente, Z-10) */}
          {/* Se tiver um arquivo ativo (viewer), escondemos a lista com display:none */}
          <div 
             className="absolute inset-0 z-10 bg-gray-50 flex flex-col"
             style={{ display: activeUrn ? 'none' : 'flex' }}
          >
             {/* Botão para fechar visualizador não é necessário aqui, pois a lista só aparece se o viewer estiver fechado */}
             <BimContent 
                context={selectedContext} 
                onFileSelect={handleFileSelect}
             />
          </div>

          {/* CONTROLE DO VIEWER (Botão Fechar) - Só aparece se Viewer ativo */}
          {activeUrn && (
              <div className="absolute top-4 left-6 z-50">
                  <button 
                      onClick={handleCloseViewer}
                      className="bg-white/90 backdrop-blur shadow-lg border border-gray-200 px-4 py-2 rounded-lg text-xs font-black text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-95 flex items-center gap-2"
                  >
                      <FontAwesomeIcon icon={faTimes} /> FECHAR VISUALIZAÇÃO
                  </button>
              </div>
          )}

      </main>
    </div>
  );
}