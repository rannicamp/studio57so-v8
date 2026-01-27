// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimInspector from '@/components/bim/BimInspector';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import GanttChart from '@/components/atividades/GanttChart'; 
import BimLinkActivityModal from '@/components/bim/BimLinkActivityModal';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import BimNoteModal from '@/components/bim/BimNoteModal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, 
    faStream, faChevronDown 
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { extrairDadosDoModelo } from '@/utils/bim/bim-extractor';

export default function BimManagerPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id } = useAuth();

  // Estados BIM
  const [activeFile, setActiveFile] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]); 
  const [loadedFiles, setLoadedFiles] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]); 
  const [isGanttOpen, setIsGanttOpen] = useState(false);
  
  const loadedModelsRef = useRef({}); 
  const globalOffsetRef = useRef(null); 

  // --- ESTADOS PARA O FLUXO DE ATIVIDADES ---
  const [contextTarget, setContextTarget] = useState(null); 
  const [modalInitialData, setModalInitialData] = useState(null); 
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // --- ESTADOS PARA NOTAS ---
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteCaptureData, setNoteCaptureData] = useState(null); 

  // Estado para edição via Gantt
  const [activityToEdit, setActivityToEdit] = useState(null);

  // --- BUSCA ATIVIDADES ---
  const { data: allActivities = [], refetch: refetchActivities } = useQuery({
    queryKey: ['bimActivities', organizacao_id],
    queryFn: async () => {
      if (!organizacao_id) return [];
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('data_inicio_prevista', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!organizacao_id
  });

  // Filtro Gantt
  const visibleActivities = useMemo(() => {
    if (loadedFiles.length === 0) return [];
    const activeProjectIds = loadedFiles
        .map(file => file.empreendimento_id ? String(file.empreendimento_id) : null)
        .filter(id => id !== null);

    if (activeProjectIds.length === 0) return [];

    const filtered = allActivities.filter(act => {
        if (!act.empreendimento_id) return false;
        return activeProjectIds.includes(String(act.empreendimento_id));
    });

    return filtered.map(act => ({
        ...act,
        start_date: act.data_inicio_prevista,
        end_date: act.data_fim_prevista,
        data_inicio_prevista: act.data_inicio_prevista,
        data_fim_prevista: act.data_fim_prevista
    }));
  }, [allActivities, loadedFiles]);

  // --- HELPER: Resolve seleção múltipla do Viewer ---
  const resolveSelection = (targetData, callback) => {
      if (!viewerInstance) {
          callback([targetData.externalId]); 
          return;
      }
      const currentSelection = viewerInstance.getSelection();
      
      if (currentSelection.length > 1) {
          const model = viewerInstance.model; 
          model.getBulkProperties(currentSelection, ['externalId'], (props) => {
              const allExternalIds = props.map(p => p.externalId);
              callback(allExternalIds);
          }, (err) => {
              callback([targetData.externalId]);
          });
      } else {
          callback([targetData.externalId]);
      }
  };

  // --- FUNÇÃO MÁGICA: GANTT -> VIEWER ---
  const handleActivitySelect = async (activity) => {
      if (!viewerInstance || !activity) return;

      const { data: links, error } = await supabase
          .from('atividades_elementos') 
          .select('external_id')
          .eq('atividade_id', activity.id);

      if (error || !links || links.length === 0) {
          viewerInstance.clearSelection();
          return;
      }

      const externalIdsToSelect = links.map(l => l.external_id);
      const allModels = viewerInstance.impl.modelQueue().getModels();
      const allDbIdsToSelect = [];

      await Promise.all(allModels.map(model => {
          return new Promise((resolve) => {
              model.getExternalIdMapping((mapping) => {
                  externalIdsToSelect.forEach(extId => {
                      if (mapping[extId]) {
                          viewerInstance.select(mapping[extId], model);
                          allDbIdsToSelect.push(mapping[extId]);
                      }
                  });
                  resolve();
              });
          });
      }));

      if (allDbIdsToSelect.length > 0) {
          viewerInstance.fitToView(allDbIdsToSelect);
          toast.info(`${allDbIdsToSelect.length} elementos vinculados.`);
      } else {
          toast.warning("Elementos vinculados não encontrados nos modelos carregados.");
      }
  };

  // --- NOVA FUNÇÃO: RESTAURAR NOTA (CORRIGIDA COM ZOOM) ---
  const handleRestoreNote = async (note) => {
    if (!viewerInstance) return;

    // Cenário 1: Nota vinculada a um elemento (Prioridade para Zoom)
    if (note.elemento_vinculado_id) {
        const extId = note.elemento_vinculado_id;
        const allModels = viewerInstance.impl.modelQueue().getModels();
        let found = false;

        // Procura em todos os modelos carregados
        for (const model of allModels) {
            await new Promise((resolve) => {
                model.getExternalIdMapping((mapping) => {
                    if (mapping[extId]) {
                        const dbId = mapping[extId];
                        
                        // 1. Restaura o estado da câmera primeiro (para pegar o ângulo salvo)
                        if (note.camera_state) {
                             try {
                                 const state = typeof note.camera_state === 'string' 
                                    ? JSON.parse(note.camera_state) 
                                    : note.camera_state;
                                 viewerInstance.restoreState(state);
                             } catch (e) { console.error("Erro parse camera", e); }
                        }

                        // 2. Seleciona o objeto
                        viewerInstance.select(dbId, model);
                        
                        // 3. O PULO DO GATO: Força o Zoom (fitToView) no objeto
                        // Isso corrige o problema de ficar "longe" devido a coordenadas globais
                        viewerInstance.fitToView([dbId], model); 
                        
                        found = true;
                    }
                    resolve();
                });
            });
            if (found) break; // Para se achar no primeiro modelo
        }

        if (found) {
            toast.success("Elemento localizado.");
            return; // Sucesso, encerra aqui
        } else {
            toast.warning("Elemento não encontrado nos modelos abertos. Restaurando apenas câmera.");
        }
    }
    
    // Cenário 2: Nota geral ou elemento não encontrado -> Restaura câmera salva
    if (note.camera_state) {
        try {
            const state = typeof note.camera_state === 'string' 
                ? JSON.parse(note.camera_state) 
                : note.camera_state;
                
            viewerInstance.restoreState(state);
            toast.success("Vista da câmera restaurada.");
        } catch (e) {
            toast.error("Erro ao restaurar vista.");
        }
    }
  };

  // --- HANDLERS DE ABERTURA DE MODAIS ---
  
  const handleOpenLink = (targetData) => {
      resolveSelection(targetData, (idsParaVincular) => {
          setContextTarget({ ...targetData, externalIds: idsParaVincular });
          setIsLinkModalOpen(true);
      });
  };

  const handleOpenCreate = (targetData) => {
      resolveSelection(targetData, (idsParaVincular) => {
          setContextTarget(targetData);
          setModalInitialData({
              nome: targetData.elementName ? `Instalação ${targetData.elementName}` : '',
              projeto_bim_id: targetData.projetoBimId, 
              elementos_bim: idsParaVincular, 
              empreendimento_id: activeFile?.empreendimento_id || null
          });
          setIsCreateModalOpen(true);
      });
  };

  const handleOpenNoteCreation = (targetData) => {
      if (!viewerInstance) return;

      const cameraState = viewerInstance.getState({ viewport: true });
      viewerInstance.getScreenShot(800, 600, (blobUrl) => {
          fetch(blobUrl)
              .then(res => res.blob())
              .then(blob => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      const base64data = reader.result;
                      setNoteCaptureData({
                          cameraState,
                          snapshot: base64data,
                          elementId: targetData?.externalId,
                          projetoBimId: activeFile?.id 
                      });
                      setIsNoteModalOpen(true);
                  };
                  reader.readAsDataURL(blob);
              });
      });
  };

  // --- ACTIONS (DB) ---
  const executeLink = async (activity) => {
      if (!contextTarget || !activity) return;
      const idsToLink = contextTarget.externalIds || [contextTarget.externalId];
      if (!idsToLink.length) return toast.error("Nenhum elemento selecionado.");

      const toastId = toast.loading(`Vinculando...`);
      try {
          const rowsToInsert = idsToLink.map(extId => ({
              organizacao_id,
              atividade_id: activity.id,
              projeto_bim_id: contextTarget.projetoBimId,
              external_id: String(extId) 
          }));

          const { error } = await supabase.from('atividades_elementos').insert(rowsToInsert);
          if (error && error.code !== '23505') throw error;

          toast.success("Vínculos criados!", { id: toastId });
          setIsLinkModalOpen(false);
          setContextTarget(null);
          queryClient.invalidateQueries(['bimElementLinks']); 
      } catch (err) {
          console.error(err);
          toast.error(err.message, { id: toastId });
      }
  };

  const executeCreate = async (activityData) => {
      setIsCreateModalOpen(false);
      setActivityToEdit(null); 
      setModalInitialData(null);
  };

  // --- VIEWER EVENTS ---
  useEffect(() => {
    if (!viewerInstance) return;
    const onAggregateSelection = (event) => {
      const aggregateSelection = viewerInstance.getAggregateSelection();
      if (aggregateSelection && aggregateSelection.length > 0) {
        const selectionSet = aggregateSelection[0];
        const model = selectionSet.model;
        const dbIds = selectionSet.selection; 
        if (model && dbIds.length > 0) {
          const dbId = dbIds[dbIds.length - 1]; 
          const fileData = model.studio57_context; 
          if (fileData) {
            setActiveFile(fileData);
            setActiveUrn(fileData.urn_autodesk.replace(/^urn:/, ''));
            setSelectedElements([]); 
            model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (results) => {
              if (results && results.length > 0) {
                const extId = results[0].externalId;
                setSelectedElements([extId]);
              }
            });
          }
        }
      } else {
        setSelectedElements([]);
      }
    };
    viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
    return () => {
      if (viewerInstance) viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
    };
  }, [viewerInstance, queryClient]);

  // --- GERENCIAMENTO DE MODELOS E OFFSET ---
  const handleToggleModel = async (file) => {
    if (!viewerInstance) return;
    
    const urnBancoLimpa = file.urn_autodesk.replace(/^urn:/, '');
    const isLoaded = selectedModels.includes(urnBancoLimpa);

    if (isLoaded) {
        const modelToUnload = loadedModelsRef.current[urnBancoLimpa];
        if (modelToUnload) {
            viewerInstance.impl.unloadModel(modelToUnload);
            delete loadedModelsRef.current[urnBancoLimpa];
            
            const newSelectedModels = selectedModels.filter(u => u !== urnBancoLimpa);
            setSelectedModels(newSelectedModels);
            setLoadedFiles(prev => prev.filter(f => f.id !== file.id)); 
            
            if (activeUrn === urnBancoLimpa) { 
                setSelectedElements([]); 
                setActiveFile(null); 
            }
            if (newSelectedModels.length === 0) {
                globalOffsetRef.current = null;
            }
            toast.success(`${file.nome_arquivo} fechado.`);
        }
    } else {
        const fullUrn = `urn:${urnBancoLimpa}`;
        const loadOptions = { keepCurrentModels: true, applyScaling: 'm', placementTransform: new THREE.Matrix4(), globalOffset: globalOffsetRef.current };

        window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewerInstance.loadModel(doc.getViewablePath(viewables), loadOptions, (model) => {
                model.studio57_context = file;
                loadedModelsRef.current[urnBancoLimpa] = model;
                if (!globalOffsetRef.current) globalOffsetRef.current = model.getData().globalOffset;
                setSelectedModels(prev => [...prev, urnBancoLimpa]);
                setLoadedFiles(prev => { if (prev.some(f => f.id === file.id)) return prev; return [...prev, file]; });
                if (file.empreendimento_id) setIsGanttOpen(true);
                toast.success(`${file.nome_arquivo} carregado`);
            });
        });
    }
  };

  const handleLoadSet = async (filesInSet) => {
    if (!viewerInstance) return;
    if (!filesInSet || filesInSet.length === 0) return toast.error("Conjunto vazio.");

    const newUrns = filesInSet.map(f => f.urn_autodesk.replace(/^urn:/, ''));
    const urnsToRemove = selectedModels.filter(urn => !newUrns.includes(urn));
    const filesToAdd = filesInSet.filter(f => !selectedModels.includes(f.urn_autodesk.replace(/^urn:/, '')));
    const toastId = toast.loading("Carregando conjunto...");

    if (urnsToRemove.length > 0) {
        urnsToRemove.forEach(urn => {
            const model = loadedModelsRef.current[urn];
            if (model) {
                viewerInstance.impl.unloadModel(model);
                delete loadedModelsRef.current[urn];
            }
        });
        if (urnsToRemove.length === selectedModels.length) globalOffsetRef.current = null;
    }

    for (const file of filesToAdd) {
        await new Promise((resolve) => {
             const urn = file.urn_autodesk.replace(/^urn:/, '');
             const fullUrn = `urn:${urn}`;
             const loadOptions = { keepCurrentModels: true, applyScaling: 'm', placementTransform: new THREE.Matrix4(), globalOffset: globalOffsetRef.current };
            window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
                const viewables = doc.getRoot().getDefaultGeometry();
                viewerInstance.loadModel(doc.getViewablePath(viewables), loadOptions, (model) => {
                    model.studio57_context = file;
                    loadedModelsRef.current[urn] = model;
                    if (!globalOffsetRef.current) globalOffsetRef.current = model.getData().globalOffset;
                    resolve();
                }, () => resolve());
            }, () => resolve());
        });
    }

    setSelectedModels(newUrns);
    setLoadedFiles(filesInSet);
    if (filesInSet[0]?.empreendimento_id) setIsGanttOpen(true);
    toast.dismiss(toastId);
    toast.success("Conjunto carregado!");
  };

  const handleSelectContext = useCallback(async (context) => {
    if (context.type === 'sync') {
      const { file } = context;
      const toastId = toast.loading(`Sincronizando...`);
      try {
        if (!viewerInstance) throw new Error("Viewer offline");
        const cleanUrn = file.urn_autodesk.replace(/^urn:/, '');
        const model = loadedModelsRef.current[cleanUrn];
        if (!model) { toast.error("Carregue o modelo primeiro.", { id: toastId }); return; }
        await extrairDadosDoModelo(model, file.id, organizacao_id);
        toast.success(`Dados atualizados!`, { id: toastId });
        queryClient.invalidateQueries(['bimElementProperties']);
      } catch (error) { toast.error("Erro: " + error.message, { id: toastId }); }
    }
  }, [viewerInstance, organizacao_id, queryClient]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col font-sans">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
            <BimSidebar 
                onFileSelect={(f) => { const clean = f.urn_autodesk.replace(/^urn:/, ''); if(!selectedModels.includes(clean)) handleToggleModel(f); }} 
                onToggleModel={handleToggleModel}
                onSelectContext={handleSelectContext}
                selectedModels={selectedModels}
                activeUrn={activeUrn} 
                onLoadSet={handleLoadSet} 
            />
        </div>

        <main className="flex-1 h-full relative flex min-w-0 bg-white">
            <div className="flex-1 relative h-full w-full flex flex-col">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={faHome} />
                    </Link>
                    <button onClick={() => setIsGanttOpen(!isGanttOpen)} className={`bg-white/90 p-2 rounded-lg shadow-sm border transition-all flex items-center gap-2 ${isGanttOpen ? 'text-blue-600 border-blue-300 ring-1' : ''}`}>
                        <FontAwesomeIcon icon={faStream} />
                        {visibleActivities.length > 0 && !isGanttOpen && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full font-bold">{visibleActivities.length}</span>}
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <AutodeskViewerAPI urn={null} onViewerReady={(v) => setViewerInstance(v)} />
                </div>

                <div className={`absolute bottom-0 left-0 right-0 z-[50] bg-white border-t border-gray-200 shadow-[0_-5px_30px_rgba(0,0,0,0.15)] transition-all duration-500 ease-in-out flex flex-col`} style={{ height: isGanttOpen ? '45%' : '0px' }}>
                    <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50 shrink-0">
                        <div className="flex items-center gap-2"><FontAwesomeIcon icon={faStream} className="text-blue-600 text-xs" /><span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cronograma ({visibleActivities.length} atv.)</span></div>
                        <button onClick={() => setIsGanttOpen(false)} className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faChevronDown} /></button>
                    </div>
                    <div className="flex-1 overflow-hidden relative bg-white p-2">
                        {visibleActivities.length > 0 ? (
                            <div className="h-full overflow-auto custom-scrollbar">
                                <GanttChart 
                                    activities={visibleActivities} 
                                    onEditActivity={handleActivitySelect} 
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2"><p className="text-sm">Nenhuma atividade.</p></div>
                        )}
                    </div>
                </div>
            </div>

            {selectedElements.length > 0 && (
                <BimInspector 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile?.id} 
                    urnAutodesk={activeUrn} 
                    onClose={() => setSelectedElements([])}
                    onOpenLink={handleOpenLink}
                    onOpenCreate={handleOpenCreate}
                    onOpenNote={handleOpenNoteCreation}
                    onRestoreNote={handleRestoreNote} 
                />
            )}
        </main>
      </div>

      <BimLinkActivityModal 
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          activities={allActivities} 
          onLink={executeLink}
          targetElement={contextTarget}
          selectedCount={contextTarget?.externalIds?.length || 1} 
      />

      {isCreateModalOpen && (
          <AtividadeModal 
              isOpen={isCreateModalOpen}
              onClose={() => { setIsCreateModalOpen(false); setActivityToEdit(null); }}
              onSuccess={executeCreate}
              initialData={modalInitialData}
              activityToEdit={activityToEdit} 
          />
      )}

      {/* MODAL DE NOTAS */}
      <BimNoteModal
         isOpen={isNoteModalOpen}
         onClose={() => setIsNoteModalOpen(false)}
         captureData={noteCaptureData}
         activities={visibleActivities}
         onSuccess={() => {
             queryClient.invalidateQueries(['bimNotes']);
             toast.success("Nota salva!");
         }}
      />
    </div>
  );
}