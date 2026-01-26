// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import GanttChart from '@/components/atividades/GanttChart'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, 
    faStream, 
    faChevronDown 
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

  const [activeFile, setActiveFile] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]); 
  
  const [loadedFiles, setLoadedFiles] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]); 

  const [isGanttOpen, setIsGanttOpen] = useState(false);
  const loadedModelsRef = useRef({}); 

  // --- 1. BUSCA CORRIGIDA COM OS CAMPOS CERTOS DO BANCO ---
  const { data: allActivities = [] } = useQuery({
    queryKey: ['bimActivities', organizacao_id],
    queryFn: async () => {
      if (!organizacao_id) return [];
      
      // AQUI ESTAVA O ERRO: 'start_date' não existe, o certo é 'data_inicio_prevista'
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('data_inicio_prevista', { ascending: true }); // <--- CORRIGIDO
        
      if (error) {
          console.error("Erro ao buscar atividades:", error);
          return [];
      }
      return data || [];
    },
    enabled: !!organizacao_id,
    staleTime: 1000 * 60 * 5 
  });

  // --- 2. FILTRO E MAPEAMENTO PARA O GANTT ---
  const visibleActivities = useMemo(() => {
    if (loadedFiles.length === 0) return [];

    // Recupera IDs dos empreendimentos ativos
    const activeProjectIds = loadedFiles
        .map(file => file.empreendimento_id ? String(file.empreendimento_id) : null)
        .filter(id => id !== null);

    console.log("[Studio 57] Empreendimentos na Tela:", activeProjectIds);

    if (activeProjectIds.length === 0) return [];

    // Filtra e prepara os dados
    const filtered = allActivities.filter(act => {
        if (!act.empreendimento_id) return false;
        return activeProjectIds.includes(String(act.empreendimento_id));
    });

    // Mapeamento de segurança: Garante que o componente receba datas válidas
    // mesmo se usar nomes diferentes internamente
    return filtered.map(act => ({
        ...act,
        start_date: act.data_inicio_prevista, // Compatibilidade
        end_date: act.data_fim_prevista,      // Compatibilidade
        // Mantemos os originais também
        data_inicio_prevista: act.data_inicio_prevista,
        data_fim_prevista: act.data_fim_prevista
    }));

  }, [allActivities, loadedFiles]);


  // --- LÓGICA DO VIEWER (MANTIDA) ---
  useEffect(() => {
    if (!viewerInstance) return;

    const onAggregateSelection = (event) => {
      const aggregateSelection = viewerInstance.getAggregateSelection();

      if (aggregateSelection && aggregateSelection.length > 0) {
        const selectionSet = aggregateSelection[0];
        const model = selectionSet.model;
        const dbIds = selectionSet.selection; 

        if (model && dbIds.length > 0) {
          const dbId = dbIds[0];
          const fileData = model.studio57_context; 

          if (fileData) {
            setActiveFile(fileData);
            setActiveUrn(fileData.urn_autodesk.replace(/^urn:/, ''));
            setSelectedElements([]); 

            model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (results) => {
              if (results && results.length > 0) {
                const extId = results[0].externalId;
                setSelectedElements([extId]);
                queryClient.invalidateQueries(['bimElementProperties']);
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
      if (viewerInstance) {
        viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
      }
    };
  }, [viewerInstance, queryClient]);


  // --- GERENCIAMENTO DE MODELOS ---
  const handleToggleModel = async (file) => {
    if (!viewerInstance) return;

    const urnBancoLimpa = file.urn_autodesk.replace(/^urn:/, '');
    const isLoaded = selectedModels.includes(urnBancoLimpa);

    if (isLoaded) {
        const modelToUnload = loadedModelsRef.current[urnBancoLimpa];
        if (modelToUnload) {
            viewerInstance.impl.unloadModel(modelToUnload);
            delete loadedModelsRef.current[urnBancoLimpa];
            
            setSelectedModels(prev => prev.filter(u => u !== urnBancoLimpa));
            setLoadedFiles(prev => prev.filter(f => f.id !== file.id)); 

            if (activeUrn === urnBancoLimpa) {
                setSelectedElements([]);
                setActiveFile(null);
            }
            toast.success(`${file.nome_arquivo} fechado.`);
        }
    } else {
        const fullUrn = `urn:${urnBancoLimpa}`;
        const loadOptions = { 
            keepCurrentModels: true, 
            applyScaling: 'm',
            globalOffset: viewerInstance.model ? viewerInstance.model.getData().globalOffset : null 
        };

        window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewerInstance.loadModel(doc.getViewablePath(viewables), loadOptions, (model) => {
                model.studio57_context = file;
                
                loadedModelsRef.current[urnBancoLimpa] = model;
                
                setSelectedModels(prev => [...prev, urnBancoLimpa]);
                setLoadedFiles(prev => {
                    if (prev.some(f => f.id === file.id)) return prev;
                    return [...prev, file];
                });
                
                if (file.empreendimento_id) {
                    setIsGanttOpen(true);
                }

                toast.success(`${file.nome_arquivo} carregado`);
            });
        });
    }
  };

  const handleSelectContext = useCallback(async (context) => {
    if (context.type === 'sync') {
      const { file } = context;
      const toastId = toast.loading(`Sincronizando: ${file.nome_arquivo}...`);
      
      try {
        if (!viewerInstance) throw new Error("Viewer offline");
        const cleanUrn = file.urn_autodesk.replace(/^urn:/, '');
        const model = loadedModelsRef.current[cleanUrn];

        if (!model) {
            toast.error("Carregue o modelo na tela primeiro.", { id: toastId });
            return;
        }

        await extrairDadosDoModelo(model, file.id, organizacao_id);
        toast.success(`Dados atualizados!`, { id: toastId });
        queryClient.invalidateQueries(['bimElementProperties']);

      } catch (error) {
        console.error("Erro sync:", error);
        toast.error("Erro: " + error.message, { id: toastId });
      }
    }
  }, [viewerInstance, organizacao_id, queryClient]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col font-sans">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
            <BimSidebar 
                onFileSelect={(f) => {
                    const clean = f.urn_autodesk.replace(/^urn:/, '');
                    if(!selectedModels.includes(clean)) handleToggleModel(f);
                }} 
                onToggleModel={handleToggleModel}
                onSelectContext={handleSelectContext}
                selectedModels={selectedModels}
                activeUrn={activeUrn} 
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
                    
                    <button 
                        onClick={() => setIsGanttOpen(!isGanttOpen)}
                        className={`bg-white/90 p-2 rounded-lg shadow-sm border transition-all flex items-center gap-2 ${isGanttOpen ? 'text-blue-600 border-blue-300 ring-1 ring-blue-200' : 'text-gray-600 hover:bg-white'}`}
                        title="Cronograma da Obra"
                    >
                        <FontAwesomeIcon icon={faStream} />
                        {visibleActivities.length > 0 && !isGanttOpen && (
                            <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full font-bold">
                                {visibleActivities.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <AutodeskViewerAPI 
                        urn={null} 
                        onViewerReady={(v) => setViewerInstance(v)}
                    />
                </div>

                <div 
                    className={`
                        absolute bottom-0 left-0 right-0 z-[50]
                        bg-white border-t border-gray-200 shadow-[0_-5px_30px_rgba(0,0,0,0.15)]
                        transition-all duration-500 ease-in-out flex flex-col
                    `}
                    style={{ height: isGanttOpen ? '45%' : '0px' }}
                >
                    <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50 shrink-0">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faStream} className="text-blue-600 text-xs" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Cronograma da Obra ({visibleActivities.length} atv.)
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsGanttOpen(false)}
                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        >
                            <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-white p-2">
                        {visibleActivities.length > 0 ? (
                            <div className="h-full overflow-auto custom-scrollbar">
                                <GanttChart 
                                    activities={visibleActivities} 
                                    onEditActivity={(act) => console.log("Editar:", act)}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                <FontAwesomeIcon icon={faStream} className="text-2xl opacity-20" />
                                <p className="text-sm">Nenhuma atividade vinculada a este empreendimento.</p>
                                <p className="text-xs opacity-60">Verifique se o ID do empreendimento está correto nas atividades.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedElements.length > 0 && (
                <BimProperties 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile?.id} 
                    urnAutodesk={activeUrn} 
                    onClose={() => setSelectedElements([])} 
                />
            )}
        </main>
      </div>
    </div>
  );
}