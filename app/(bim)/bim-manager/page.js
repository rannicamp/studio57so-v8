// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import GanttChart from '@/components/atividades/GanttChart'; 
import BimLinkActivityModal from '@/components/bim/BimLinkActivityModal'; // 1. Importação do novo Modal
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, faTimes, 
    faCube, faStream, faChevronUp, faChevronDown, faPlus, faLink
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
  const [isLinkingListOpen, setIsLinkingListOpen] = useState(false); 

  // --- CARREGAMENTO DE DADOS AUXILIARES (PARA O MODAL FUNCIONAR) ---
  const { data: auxData } = useQuery({
      queryKey: ['bimAuxData', organizacao_id],
      queryFn: async () => {
          const { data: empresas } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacao_id);
          const { data: emps } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacao_id);
          const { data: funcs } = await supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacao_id);
          return { empresas: empresas || [], empreendimentos: emps || [], funcionarios: funcs || [] };
      },
      enabled: !!organizacao_id
  });

  // Atividades para o Gantt e para a Lista de Vínculo
  const { data: activities = [], refetch: refetchActivities } = useQuery({
      queryKey: ['atividades_bim', activeFile?.empreendimento_id, organizacao_id],
      queryFn: async () => {
          if (!activeFile?.empreendimento_id || !organizacao_id) return [];
          const { data } = await supabase.from('activities').select('*').eq('empreendimento_id', activeFile.empreendimento_id).eq('organizacao_id', organizacao_id).order('data_inicio_prevista');
          return data || [];
      },
      enabled: !!activeFile?.empreendimento_id && !!organizacao_id
  });

  // --- FUNÇÃO PARA ATUALIZAR SELEÇÃO (CHAMADA NO CLIQUE ESQUERDO E DIREITO) ---
  const updateSelection = (dbIdArray) => {
      if (!viewerInstance) return;
      if (dbIdArray && dbIdArray.length > 0) {
          viewerInstance.model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
              setSelectedElements(results.map(r => r.externalId));
          });
      } else {
          setSelectedElements([]);
      }
  };

  const highlightElementsForActivity = async (activity) => {
      if (!viewerInstance || !activeFile) return;
      const vinculos = await getElementosPorAtividades([activity.id], activeFile.id);
      const externalIds = vinculos.map(v => v.external_id);
      if (externalIds.length === 0) { toast.info("Sem elementos vinculados."); return; }

      viewerInstance.model.getExternalIdMapping((mapping) => {
          const dbIds = externalIds.map(extId => mapping[extId]).filter(Boolean);
          viewerInstance.select(dbIds);
          viewerInstance.fitToView(dbIds);
          const color = new window.THREE.Vector4(0, 0.5, 1, 0.7); 
          viewerInstance.clearThemingColors();
          dbIds.forEach(id => viewerInstance.setThemingColor(id, color));
      });
  };

  const handleLinkExisting = async (activityId) => {
      if (selectedElements.length === 0) {
          toast.error("Nenhum elemento selecionado no modelo.");
          return;
      }

      const promise = new Promise(async (resolve, reject) => {
          try {
              const rows = selectedElements.map(extId => ({
                  organizacao_id,
                  atividade_id: activityId,
                  projeto_bim_id: activeFile.id,
                  external_id: extId
              }));

              const { error } = await supabase.from('atividades_elementos').insert(rows);
              
              if (error) {
                  if (error.code === '23505') {
                       resolve(); 
                  } else {
                      throw error;
                  }
              }
              resolve();
          } catch (e) { 
              reject(e); 
          }
      });

      toast.promise(promise, {
          loading: 'Vinculando elementos...',
          success: () => {
              setIsLinkingListOpen(false);
              refetchActivities();
              const activity = activities.find(a => a.id === activityId);
              if (activity) highlightElementsForActivity(activity);
              return "Vínculo realizado com sucesso!";
          },
          error: (err) => "Erro ao vincular: " + err.message
      });
  };

  // --- CONFIGURAÇÃO DO MENU DE CONTEXTO ---
  const setupContextMenu = (v) => {
      v.container.addEventListener('contextmenu', (e) => {
          const canvasRect = v.container.getBoundingClientRect();
          const x = e.clientX - canvasRect.left;
          const y = e.clientY - canvasRect.top;
          const result = v.impl.hitTest(x, y);
          
          if (result && result.dbId) {
              v.select([result.dbId]);
              updateSelection([result.dbId]);
              setContextMenu({ x: e.clientX + 5, y: e.clientY });
          }
      });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0`}>
            <BimSidebar onFileSelect={(f) => { setActiveUrn(f.urn_autodesk); setActiveFile(f); setSelectedElements([]); }} activeUrn={activeUrn} />
        </div>

        <main className="flex-1 h-full relative flex min-w-0" onClick={() => setContextMenu(null)}>
            <div className="flex-1 relative h-full">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border transition-all hover:bg-white"><FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} /></button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 transition-all hover:bg-white"><FontAwesomeIcon icon={faHome} /></Link>
                </div>
                {activeUrn ? (
                    <AutodeskViewerAPI urn={activeUrn} onViewerReady={(v) => {
                        setViewerInstance(v);
                        v.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (ev) => {
                            updateSelection(ev.dbIdArray);
                        });
                        setupContextMenu(v);
                    }}/>
                ) : <div className="h-full flex items-center justify-center opacity-20 font-black text-2xl italic uppercase tracking-[0.3em] select-none">Studio 57 BIM</div>}
            </div>

            {selectedElements.length === 1 && activeFile && (
                <BimProperties elementExternalId={selectedElements[0]} projetoBimId={activeFile.id} onClose={() => setSelectedElements([])} />
            )}

            {contextMenu && (
                <div className="fixed z-[9999] bg-white shadow-2xl border border-gray-100 rounded-xl p-1.5 w-60 animate-in fade-in zoom-in duration-75" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="px-3 py-1 border-b mb-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações Studio 57</p>
                        <p className="text-[9px] font-bold text-blue-500 uppercase">{selectedElements.length} selecionados</p>
                    </div>
                    <button onClick={() => { setIsActivityModalOpen(true); setContextMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white rounded-lg flex items-center gap-2 transition-all group">
                        <FontAwesomeIcon icon={faPlus} className="text-blue-500 group-hover:text-white" /> Criar Atividade 4D
                    </button>
                    <button onClick={() => { setIsLinkingListOpen(true); setContextMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white rounded-lg flex items-center gap-2 transition-all group">
                        <FontAwesomeIcon icon={faLink} className="text-blue-500 group-hover:text-white" /> Vincular a Existente
                    </button>
                </div>
            )}

            {/* MODAL DE VÍNCULO RÁPIDO - COMPONENTE MODULARIZADO */}
            <BimLinkActivityModal 
                isOpen={isLinkingListOpen}
                onClose={() => setIsLinkingListOpen(false)}
                activities={activities}
                selectedCount={selectedElements.length}
                onLink={handleLinkExisting}
            />
        </main>
      </div>

      {/* GANTT INFERIOR */}
      {activeFile && (
          <div className={`bg-white border-t border-gray-200 transition-all duration-500 flex flex-col z-[70] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] ${isGanttVisible ? 'h-[45vh]' : 'h-10'}`}>
              <div onClick={() => setIsGanttVisible(!isGanttVisible)} className="h-10 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-50 transition-colors shrink-0">
                  <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faStream} className="text-blue-600" />
                      <span className="text-[11px] font-black uppercase tracking-widest italic text-gray-700">Execução 4D: {activeFile.nome_arquivo}</span>
                      <div className="h-3 w-px bg-gray-300 mx-1"></div>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">{activities.length} Atividades</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-[9px] font-bold uppercase tracking-widest">{isGanttVisible ? 'Recolher' : 'Expandir Cronograma'}</span>
                      <FontAwesomeIcon icon={isGanttVisible ? faChevronDown : faChevronUp} className="text-xs" />
                  </div>
              </div>
              {isGanttVisible && <div className="flex-1 overflow-hidden bg-white"><GanttChart activities={activities} onEditActivity={highlightElementsForActivity} /></div>}
          </div>
      )}

      {/* MODAL DE ATIVIDADE COM DADOS COMPLETOS */}
      {isActivityModalOpen && (
          <AtividadeModal 
            isOpen={isActivityModalOpen} 
            onClose={() => setIsActivityModalOpen(false)} 
            onActivityAdded={() => { refetchActivities(); setIsActivityModalOpen(false); }}
            allEmpresas={auxData?.empresas} 
            selectedEmpreendimento={auxData?.empreendimentos.find(e => e.id === activeFile.empreendimento_id)}
            funcionarios={auxData?.funcionarios}
            initialData={{ 
                projeto_bim_id: activeFile.id, 
                elementos_bim: selectedElements,
                empreendimento_id: activeFile.empreendimento_id 
            }} 
          />
      )}
    </div>
  );
}