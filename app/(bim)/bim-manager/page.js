// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import GanttChart from '@/components/atividades/GanttChart'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, 
    faChevronRight, 
    faHome, 
    faTimes, 
    faCube, 
    faStream, 
    faChevronUp, 
    faChevronDown,
    faPlus,
    faLink
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
  const [isGanttVisible, setIsGanttVisible] = useState(false); 
  
  const [selectedElements, setSelectedElements] = useState([]); 
  const [contextMenu, setContextMenu] = useState(null); 
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // 1. BUSCA ATIVIDADES - FILTRADO POR EMPREENDIMENTO
  const { data: activities = [], refetch: refetchActivities } = useQuery({
      queryKey: ['atividades_bim', activeFile?.empreendimento_id, organizacao_id],
      queryFn: async () => {
          if (!activeFile?.empreendimento_id || !organizacao_id) return [];
          const { data } = await supabase
            .from('activities')
            .select('*')
            .eq('empreendimento_id', activeFile.empreendimento_id)
            .eq('organizacao_id', organizacao_id)
            .order('data_inicio_prevista');
          return data || [];
      },
      enabled: !!activeFile?.empreendimento_id && !!organizacao_id
  });

  // 2. DESTAQUE 4D
  const highlightElementsForActivity = async (activity) => {
      if (!viewerInstance || !activeFile) return;
      const vinculos = await getElementosPorAtividades([activity.id], activeFile.id);
      const externalIds = vinculos.map(v => v.external_id);

      if (externalIds.length === 0) {
          toast.info("Atividade sem elementos vinculados.");
          viewerInstance.clearSelection();
          return;
      }

      viewerInstance.model.getExternalIdMapping((mapping) => {
          const dbIds = externalIds.map(extId => mapping[extId]).filter(Boolean);
          viewerInstance.select(dbIds);
          viewerInstance.fitToView(dbIds);
          const color = new window.THREE.Vector4(0, 0.5, 1, 0.7); 
          viewerInstance.clearThemingColors();
          dbIds.forEach(id => viewerInstance.setThemingColor(id, color));
      });
  };

  // Efeito global para fechar menus
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // FUNÇÃO DE SELEÇÃO UNIFICADA (Propriedades + Contexto)
  const updateSelectionState = (dbIdArray) => {
      if (dbIdArray && dbIdArray.length > 0 && viewerInstance) {
          viewerInstance.model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
              const ids = results.map(r => r.externalId);
              setSelectedElements(ids);
          });
      } else {
          setSelectedElements([]);
      }
  };

  // --- SENSOR DE CLIQUE DIREITO CORRIGIDO (LADO A LADO) ---
  const setupContextMenu = (v) => {
      v.container.addEventListener('contextmenu', (e) => {
          // 1. Descobrir em quem clicamos
          const canvasRect = v.container.getBoundingClientRect();
          const x = e.clientX - canvasRect.left;
          const y = e.clientY - canvasRect.top;
          const result = v.impl.hitTest(x, y);
          
          if (result && result.dbId) {
              // 2. Forçar a seleção para abrir a barra de propriedades
              v.select([result.dbId]);
              updateSelectionState([result.dbId]);

              // 3. Abrir o menu coladinho (ajustamos para 162px fixos de distância)
              setContextMenu({ 
                  x: e.clientX + 162, 
                  y: e.clientY 
              });
          }
      });
  };

  const handleFileSelect = (file) => {
      if (!file) return;
      setActiveUrn(file.urn_autodesk);
      setActiveFile(file);
      setSelectedElements([]);
      localStorage.setItem('studio57_last_bim_urn', file.urn_autodesk);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col">
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 overflow-hidden shrink-0`}>
            <BimSidebar onFileSelect={handleFileSelect} activeUrn={activeUrn} />
        </div>

        {/* ÁREA CENTRAL */}
        <main className="flex-1 h-full relative flex min-w-0">
            <div className="flex-1 relative h-full">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 hover:bg-white p-2 rounded-lg shadow-md border border-gray-200 transition-all">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                    <Link href="/dashboard" className="bg-white/90 hover:bg-white p-2 rounded-lg shadow-md border border-gray-200 text-gray-600">
                        <FontAwesomeIcon icon={faHome} />
                    </Link>
                </div>

                {activeUrn ? (
                    <AutodeskViewerAPI 
                        urn={activeUrn} 
                        onViewerReady={(v) => {
                            setViewerInstance(v);
                            // Sincroniza clique esquerdo
                            v.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (ev) => {
                                updateSelectionState(ev.dbIdArray);
                            });
                            // Configura clique direito
                            setupContextMenu(v);
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                        <FontAwesomeIcon icon={faCube} className="text-4xl opacity-20 mb-4" />
                        <p className="font-black text-xl uppercase tracking-[0.3em] opacity-20 italic">Studio 57 BIM</p>
                    </div>
                )}
            </div>

            {/* BARRA DE PROPRIEDADES (SÓ ABRE SE HOUVER 1 ELEMENTO) */}
            {selectedElements.length === 1 && activeFile && (
                <BimProperties 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile.id} 
                    onClose={() => {
                        setSelectedElements([]);
                        viewerInstance?.clearSelection();
                    }} 
                />
            )}

            {/* MENU DE CONTEXTO STUDIO 57 */}
            {contextMenu && (
                <div 
                    className="fixed z-[9999] bg-white shadow-2xl border border-gray-100 rounded-xl p-1.5 w-60 animate-in fade-in zoom-in duration-100 origin-top-left" 
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="px-3 py-2 border-b border-gray-50 mb-1 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">Ações 4D</p>
                    </div>
                    <button 
                        onClick={() => { setIsActivityModalOpen(true); setContextMenu(null); }} 
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white rounded-lg flex items-center gap-2 transition-all group"
                    >
                        <FontAwesomeIcon icon={faPlus} className="w-3 text-blue-500 group-hover:text-white" /> 
                        Criar Atividade 4D
                    </button>
                    <button className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white rounded-lg flex items-center gap-2 transition-all group">
                        <FontAwesomeIcon icon={faLink} className="w-3 text-blue-500 group-hover:text-white" /> 
                        Vincular a Existente
                    </button>
                </div>
            )}
        </main>
      </div>

      {/* GANTT INFERIOR */}
      {activeFile && (
          <div className={`bg-white border-t border-gray-200 transition-all duration-500 flex flex-col z-[70] ${isGanttVisible ? 'h-[45vh]' : 'h-10'}`}>
              <div 
                onClick={() => setIsGanttVisible(!isGanttVisible)}
                className="h-10 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-50 shrink-0"
              >
                  <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faStream} className="text-blue-600" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Cronograma: {activeFile.nome_arquivo}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">{activities.length} Atividades</span>
                  </div>
                  <FontAwesomeIcon icon={isGanttVisible ? faChevronDown : faChevronUp} className="text-gray-400" />
              </div>

              {isGanttVisible && (
                  <div className="flex-1 overflow-hidden">
                      <GanttChart 
                        activities={activities} 
                        onEditActivity={highlightElementsForActivity} 
                      />
                  </div>
              )}
          </div>
      )}

      {isActivityModalOpen && (
          <AtividadeModal 
            isOpen={isActivityModalOpen} 
            onClose={() => setIsActivityModalOpen(false)} 
            initialData={{ 
                projeto_bim_id: activeFile.id, 
                elementos_bim: selectedElements,
                empreendimento_id: activeFile.empreendimento_id 
            }} 
            onActivityAdded={() => {
                toast.success("Vínculo Criado!");
                refetchActivities();
            }}
          />
      )}
    </div>
  );
}