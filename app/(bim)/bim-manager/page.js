// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import GanttChart from '@/components/atividades/GanttChart'; // Importando seu Gantt
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, faTimes, 
    faCube, faStream, faChevronUp, faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { getElementosPorAtividades } from '@/utils/bim/bim-relationships';
import { toast } from 'sonner';

export default function BimManagerPage() {
  const supabase = createClient();
  const { organizacao_id, user } = useAuth();

  const [activeUrn, setActiveUrn] = useState(null); 
  const [activeFile, setActiveFile] = useState(null); 
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [isGanttVisible, setIsGanttVisible] = useState(false); // Controle da barra inferior
  
  const [selectedElements, setSelectedElements] = useState([]); 
  const [contextMenu, setContextMenu] = useState(null); 
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // 1. BUSCA ATIVIDADES DO EMPREENDIMENTO ATIVO PARA O GANTT
  const { data: activities = [] } = useQuery({
      queryKey: ['atividades_bim', activeFile?.empreendimento_id],
      queryFn: async () => {
          if (!activeFile?.empreendimento_id) return [];
          const { data } = await supabase
            .from('activities')
            .select('*')
            .eq('empreendimento_id', activeFile.empreendimento_id)
            .order('data_inicio_prevista');
          return data || [];
      },
      enabled: !!activeFile?.empreendimento_id
  });

  // 2. FUNÇÃO MÁGICA: Destacar elementos no 3D ao clicar no cronograma
  const highlightElementsForActivity = async (activity) => {
      if (!viewerInstance || !activeFile) return;

      const vinculos = await getElementosPorAtividades([activity.id], activeFile.id);
      const externalIds = vinculos.map(v => v.external_id);

      if (externalIds.length === 0) {
          toast.info("Esta atividade não possui elementos vinculados no 3D.");
          viewerInstance.clearSelection();
          return;
      }

      // Converte External IDs de volta para dbIds do Viewer para poder selecionar
      viewerInstance.model.getExternalIdMapping((mapping) => {
          const dbIds = externalIds.map(extId => mapping[extId]).filter(Boolean);
          viewerInstance.select(dbIds);
          viewerInstance.fitToView(dbIds);
          
          // Opcional: Colorir de Azul temporariamente para destaque
          const color = new window.THREE.Vector4(0, 0.5, 1, 0.5); // Azul transparente
          viewerInstance.clearThemingColors();
          dbIds.forEach(id => viewerInstance.setThemingColor(id, color));
      });
  };

  // ... (manter useEffects e handlers de seleção e contextMenu iguais ao anterior) ...
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('wheel', closeMenu); 
    return () => {
        window.removeEventListener('click', closeMenu);
        window.removeEventListener('wheel', closeMenu);
    };
  }, []);

  const handleSelectionChange = (event) => {
      const dbIdArray = event.dbIdArray;
      if (dbIdArray && dbIdArray.length > 0 && viewerInstance) {
          viewerInstance.model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
              const ids = results.map(r => r.externalId);
              setSelectedElements(ids);
          });
      } else {
          setSelectedElements([]);
      }
  };

  const handleContextMenu = (e) => {
      if (selectedElements.length > 0) {
          setContextMenu({ x: e.clientX + 162, y: e.clientY });
      }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 relative flex-col">
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 overflow-hidden shrink-0`}>
            <BimSidebar 
                onFileSelect={(file) => {
                    setActiveUrn(file.urn_autodesk);
                    setActiveFile(file);
                    setSelectedElements([]);
                    localStorage.setItem('studio57_last_bim_urn', file.urn_autodesk);
                }} 
                activeUrn={activeUrn}
            />
        </div>

        {/* ÁREA CENTRAL */}
        <main className="flex-1 h-full relative flex min-w-0" onContextMenu={handleContextMenu}>
            <div className="flex-1 relative h-full">
                {/* HEADER FLUTUANTE */}
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                </div>

                {activeUrn ? (
                    <AutodeskViewerAPI 
                        urn={activeUrn} 
                        onViewerReady={(v) => {
                            setViewerInstance(v);
                            v.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, handleSelectionChange);
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                        <FontAwesomeIcon icon={faCube} className="text-6xl mb-4 opacity-20" />
                        <p className="font-black text-2xl uppercase tracking-widest opacity-20">Selecione um projeto</p>
                    </div>
                )}
            </div>

            {/* PROPRIEDADES */}
            {selectedElements.length === 1 && activeFile && !contextMenu && (
                <BimProperties elementExternalId={selectedElements[0]} projetoBimId={activeFile.id} onClose={() => setSelectedElements([])} />
            )}

            {/* CONTEXT MENU (LADO A LADO) */}
            {contextMenu && (
                <div className="fixed z-[9999] bg-white shadow-2xl border border-gray-100 rounded-xl p-1.5 w-60" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="px-3 py-2 border-b border-gray-50 mb-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Studio 57 Ações 4D</p>
                    </div>
                    <button onClick={() => { setIsActivityModalOpen(true); setContextMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white rounded-lg flex items-center gap-2 transition-all">
                        <FontAwesomeIcon icon={faCube} className="w-3" /> Criar Atividade 4D
                    </button>
                </div>
            )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* BARRA INFERIOR: O CRONOGRAMA GANTT */}
      {/* ========================================================================= */}
      {activeFile && (
          <div className={`bg-white border-t border-gray-200 transition-all duration-500 flex flex-col z-[70] ${isGanttVisible ? 'h-[40vh]' : 'h-10'}`}>
              <div 
                onClick={() => setIsGanttVisible(!isGanttVisible)}
                className="h-10 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
              >
                  <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faStream} className="text-blue-600" />
                      <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Cronograma de Execução 4D</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{activities.length} Atividades</span>
                  </div>
                  <FontAwesomeIcon icon={isGanttVisible ? faChevronDown : faChevronUp} className="text-gray-400" />
              </div>

              {isGanttVisible && (
                  <div className="flex-1 overflow-hidden bg-white">
                      <GanttChart 
                        activities={activities} 
                        onEditActivity={(activity) => highlightElementsForActivity(activity)} // Ao clicar, destaca no 3D
                      />
                  </div>
              )}
          </div>
      )}

      {isActivityModalOpen && (
          <AtividadeModal 
            isOpen={isActivityModalOpen} 
            onClose={() => setIsActivityModalOpen(false)} 
            initialData={{ projeto_bim_id: activeFile.id, elementos_bim: selectedElements }} 
            onActivityAdded={() => toast.success("Atividade vinculada!")}
          />
      )}
    </div>
  );
}