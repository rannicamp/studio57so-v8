// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, faTimes, 
    faDatabase, faCube, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { extrairDadosDoModelo } from '@/utils/bim/bim-extractor';
import { toast } from 'sonner';

export default function BimManagerPage() {
  const { organizacao_id } = useAuth();

  const [selectedContext, setSelectedContext] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null); 
  const [activeFile, setActiveFile] = useState(null); 
  
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);

  // Estados para Mineração de Dados (Sincronização individual)
  const [syncStates, setSyncStates] = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedUrn = localStorage.getItem('studio57_last_bim_urn');
        const savedContext = localStorage.getItem('studio57_last_bim_context');
        if (savedUrn) setActiveUrn(savedUrn);
        if (savedContext) try { setSelectedContext(JSON.parse(savedContext)); } catch (e) {}
    }
  }, []);

  // Modificado para lidar com a sincronização vinda do Sidebar
  const handleContextSelect = async (context) => {
      // Se o contexto for do tipo 'sync', disparar a extração
      if (context?.type === 'sync') {
          await handleSyncData(context.file);
          return;
      }
      
      setSelectedContext(context);
      localStorage.setItem('studio57_last_bim_context', JSON.stringify(context));
  };

  const handleFileSelect = (file) => {
      if (!file) return;
      const urn = file.urn_autodesk || file;
      setActiveUrn(urn);
      
      if (typeof file === 'object') {
          setActiveFile(file);
      }
      
      localStorage.setItem('studio57_last_bim_urn', urn);
  };

  const handleCloseViewer = () => {
      setActiveUrn(null);
      setActiveFile(null);
      setViewerInstance(null);
      localStorage.removeItem('studio57_last_bim_urn');
  };

  // Lógica de Sincronização disparada pelo Sidebar
  const handleSyncData = async (fileToSync) => {
      if (!viewerInstance || activeUrn !== fileToSync.urn_autodesk) {
          toast.error("Abra este modelo no visualizador antes de sincronizar!");
          return;
      }

      try {
          // Atualiza o estado de sincronização para este arquivo específico
          setSyncStates(prev => ({ ...prev, [fileToSync.id]: { isSyncing: true, progress: 0 } }));
          
          await extrairDadosDoModelo(
              viewerInstance, 
              fileToSync.id, 
              organizacao_id, 
              (prog) => {
                  setSyncStates(prev => ({ 
                      ...prev, 
                      [fileToSync.id]: { ...prev[fileToSync.id], progress: prog } 
                  }));
              }
          );
          
          toast.success(`Dados de "${fileToSync.nome_arquivo}" sincronizados!`);
      } catch (error) {
          console.error(error);
          toast.error("Erro na extração: " + error.message);
      } finally {
          setSyncStates(prev => ({ ...prev, [fileToSync.id]: { isSyncing: false, progress: 100 } }));
      }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 relative">
      
      {/* 1. BARRA LATERAL (Único meio de acesso) */}
      <div 
        className={`
            relative h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col z-20
            ${isSidebarVisible ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
        `}
      >
         <BimSidebar 
            onSelectContext={handleContextSelect} 
            onFileSelect={handleFileSelect} 
            selectedContext={selectedContext} 
            activeUrn={activeUrn}
            syncStates={syncStates} // Passando os estados de carregamento
         />
      </div>

      {/* BOTÃO DE COLAPSAR */}
      <button 
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        className={`
            absolute top-1/2 z-50 transform -translate-y-1/2 
            bg-white border border-gray-200 shadow-md text-gray-500 hover:text-blue-600
            w-6 h-12 flex items-center justify-center rounded-r-lg transition-all duration-300
            ${isSidebarVisible ? 'left-80' : 'left-0'}
        `}
      >
          <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} size="xs" />
      </button>

      {/* 2. ÁREA PRINCIPAL (Visualização do Modelo) */}
      <main className="flex-1 h-full relative bg-gray-200 flex flex-col min-w-0">
          
          {/* HEADER FLUTUANTE */}
          <div className="absolute top-4 right-4 z-[60] flex gap-2">
            <Link 
                href="/dashboard" 
                className="bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 backdrop-blur transition-all text-xs font-bold flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faHome} /> SISTEMA
            </Link>
            {activeUrn && (
                <button 
                    onClick={handleCloseViewer}
                    className="bg-white/90 hover:bg-red-50 text-red-600 p-2 rounded-lg shadow-sm border border-gray-200 backdrop-blur transition-all text-xs font-bold flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faTimes} /> FECHAR
                </button>
            )}
          </div>

          <div className="w-full h-full">
             {activeUrn ? (
                 <AutodeskViewerAPI 
                    urn={activeUrn} 
                    onViewerReady={(v) => setViewerInstance(v)}
                 />
             ) : (
                 <div className="flex flex-col items-center justify-center h-full text-gray-300">
                     <FontAwesomeIcon icon={faCube} className="text-6xl mb-4 opacity-20" />
                     <p className="font-black text-2xl uppercase tracking-widest select-none opacity-20">Selecione um projeto</p>
                 </div>
             )}
          </div>
      </main>
    </div>
  );
}