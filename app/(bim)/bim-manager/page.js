// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
// --- O GANTT VOLTOU ---
import GanttChart from '@/components/atividades/GanttChart'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, 
    faStream, // Ícone do Cronograma
    faChevronDown, faTimes
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

  // Estados do BIM
  const [activeFile, setActiveFile] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]); 
  const [selectedModels, setSelectedModels] = useState([]); 

  // Estado do Gantt (Colapsável)
  const [isGanttOpen, setIsGanttOpen] = useState(false);

  const loadedModelsRef = useRef({}); 

  // --- BUSCA DE ATIVIDADES (Para o Gantt) ---
  const { data: activities = [] } = useQuery({
    queryKey: ['bimActivities', organizacao_id],
    queryFn: async () => {
      if (!organizacao_id) return [];
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('start_date', { ascending: true });
        
      if (error) console.error("Erro atividades:", error);
      return data || [];
    },
    enabled: !!organizacao_id
  });

  // --- LÓGICA DE SELEÇÃO BIM (A BLINDADA) ---
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
          // O "Carimbo" que injetamos no carregamento
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


  // --- CARREGAR MODELOS ---
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
            if (activeUrn === urnBancoLimpa) {
                setSelectedElements([]);
                setActiveFile(null);
            }
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
                // Injeção de Contexto (O Segredo do Sucesso)
                model.studio57_context = file;
                loadedModelsRef.current[urnBancoLimpa] = model;
                setSelectedModels(prev => [...prev, urnBancoLimpa]);
                toast.success(`${file.nome_arquivo} carregado`);
            });
        });
    }
  };

  // --- EXTRAÇÃO DE DADOS ---
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

        toast.success(`Dados de ${file.nome_arquivo} atualizados!`, { id: toastId });
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
        {/* SIDEBAR ESQUERDA */}
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

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 h-full relative flex min-w-0 bg-white">
            <div className="flex-1 relative h-full w-full">
                
                {/* TOOLBAR FLUTUANTE SUPERIOR */}
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={faHome} />
                    </Link>
                    {/* BOTÃO DO GANTT */}
                    <button 
                        onClick={() => setIsGanttOpen(!isGanttOpen)}
                        className={`bg-white/90 p-2 rounded-lg shadow-sm border transition-all ${isGanttOpen ? 'text-blue-600 border-blue-300 ring-1 ring-blue-200' : 'text-gray-600 hover:bg-white'}`}
                        title="Abrir Cronograma"
                    >
                        <FontAwesomeIcon icon={faStream} />
                    </button>
                </div>

                {/* VISUALIZADOR 3D */}
                <div className="w-full h-full">
                    <AutodeskViewerAPI 
                        urn={null} 
                        onViewerReady={(v) => setViewerInstance(v)}
                    />
                </div>

                {/* --- PAINEL GANTT COLAPSÁVEL (OVERLAY) --- */}
                <div 
                    className={`
                        absolute bottom-0 left-0 right-0 z-[50]
                        bg-white border-t border-gray-200 shadow-[0_-5px_30px_rgba(0,0,0,0.15)]
                        transition-all duration-300 ease-in-out flex flex-col
                    `}
                    style={{ height: isGanttOpen ? '400px' : '0px' }}
                >
                    {/* Header do Gantt */}
                    <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50 shrink-0">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faStream} className="text-blue-600 text-xs" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cronograma de Atividades</span>
                        </div>
                        <button 
                            onClick={() => setIsGanttOpen(false)}
                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        >
                            <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                    </div>

                    {/* Conteúdo do Gantt */}
                    <div className="flex-1 overflow-hidden relative bg-white">
                        {isGanttOpen && (
                            <div className="absolute inset-0 overflow-auto custom-scrollbar p-2">
                                <GanttChart 
                                    activities={activities} 
                                    onEditActivity={(act) => console.log("Editar:", act)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SIDEBAR DIREITA (PROPRIEDADES) */}
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