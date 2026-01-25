// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import GanttChart from '@/components/atividades/GanttChart'; 
import BimLinkActivityModal from '@/components/bim/BimLinkActivityModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, faTimes, 
    faCube, faStream, faChevronUp, faChevronDown, faPlus, faLink
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function BimManagerPage() {
  const supabase = createClient();
  const { organizacao_id } = useAuth();

  // ESTADOS DE CONTROLE
  const [activeFile, setActiveFile] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [isGanttVisible, setIsGanttVisible] = useState(false); 
  
  const [selectedElements, setSelectedElements] = useState([]); 
  const [contextMenu, setContextMenu] = useState(null); 
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isLinkingListOpen, setIsLinkingListOpen] = useState(false); 

  // ESTADOS DE FEDERAÇÃO (MAPAS DE REFERÊNCIA)
  const [selectedModels, setSelectedModels] = useState([]); 
  const loadedModelsRef = useRef({}); // URN -> Model Instance
  const filesMapRef = useRef({});   // URN -> File Object (Crucial para o clique)

  // --- BUSCA DE DADOS ---
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

  const { data: activities = [], refetch: refetchActivities } = useQuery({
      queryKey: ['atividades_bim', activeFile?.empreendimento_id, organizacao_id],
      queryFn: async () => {
          if (!activeFile?.empreendimento_id) return [];
          const { data } = await supabase.from('activities').select('*').eq('empreendimento_id', activeFile.empreendimento_id).eq('organizacao_id', organizacao_id).order('data_inicio_prevista');
          return data || [];
      },
      enabled: !!activeFile?.empreendimento_id
  });

  // --- LÓGICA DE SELEÇÃO DE ELEMENTOS ---
  const handleSelection = useCallback((dbIdArray, urn, model) => {
    if (dbIdArray.length > 0 && urn) {
        // 1. Identifica o arquivo pelo URN retornado pelo Viewer
        const file = filesMapRef.current[urn];
        if (file) {
            setActiveFile(file);
            setActiveUrn(urn);
            
            // 2. Busca o ExternalID para o painel de propriedades
            model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
                if (results.length > 0) {
                    setSelectedElements([results[0].externalId]);
                }
            });
        }
    } else {
        setSelectedElements([]);
        // Mantemos o activeFile para não fechar o Gantt bruscamente
    }
  }, []);

  // --- LÓGICA DE CARGA DE MODELOS ---
  const handleToggleModel = async (file) => {
    if (!viewerInstance) return;
    const urn = file.urn_autodesk;
    const isLoaded = selectedModels.includes(urn);

    if (isLoaded) {
        const modelToUnload = loadedModelsRef.current[urn];
        if (modelToUnload) {
            viewerInstance.impl.unloadModel(modelToUnload);
            delete loadedModelsRef.current[urn];
            delete filesMapRef.current[urn];
            setSelectedModels(prev => prev.filter(u => u !== urn));
            if (activeFile?.urn_autodesk === urn) setActiveFile(null);
            toast.info(`Removido: ${file.nome_arquivo}`);
        }
    } else {
        const documentId = `urn:${urn}`;
        window.Autodesk.Viewing.Document.load(documentId, (doc) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewerInstance.loadModel(doc.getViewablePath(viewables), { 
                keepCurrentModels: true,
                modelNameOverride: file.nome_arquivo 
            }, (model) => {
                loadedModelsRef.current[urn] = model;
                filesMapRef.current[urn] = file; // Registra o arquivo no mapa
                setSelectedModels(prev => [...prev, urn]);
                toast.success(`Mesclado: ${file.nome_arquivo}`);
            });
        });
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col">
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
            <BimSidebar 
                onFileSelect={(f) => { 
                    setActiveFile(f); 
                    setActiveUrn(f.urn_autodesk);
                    filesMapRef.current[f.urn_autodesk] = f; 
                    if(!selectedModels.includes(f.urn_autodesk)) handleToggleModel(f);
                }} 
                onToggleModel={handleToggleModel}
                selectedModels={selectedModels}
                activeUrn={activeUrn} 
            />
        </div>

        <main className="flex-1 h-full relative flex min-w-0">
            <div className="flex-1 relative h-full">
                {/* Botões Superiores */}
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border hover:bg-white transition-all">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={faHome} />
                    </Link>
                </div>

                {/* VISUALIZADOR COM SELEÇÃO INTELIGENTE */}
                <AutodeskViewerAPI 
                    urn={null} 
                    onSelectionChange={handleSelection}
                    onViewerReady={(v) => {
                        setViewerInstance(v);
                        v.container.addEventListener('contextmenu', (e) => {
                            const result = v.impl.hitTest(e.clientX, e.clientY);
                            if (result) setContextMenu({ x: e.clientX, y: e.clientY });
                        });
                    }}
                />
            </div>

            {/* PAINEL DE PROPRIEDADES */}
            {selectedElements.length > 0 && activeFile && (
                <BimProperties 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile.id} 
                    onClose={() => setSelectedElements([])} 
                />
            )}
        </main>
      </div>

      {/* GANTT CHROME ESTILO STUDIO 57 */}
      {activeFile && (
          <div className={`fixed bottom-0 left-0 right-0 bg-white border-t transition-all duration-500 flex flex-col z-[70] shadow-2xl ${isGanttVisible ? 'h-[45vh]' : 'h-10'}`} style={{ left: isSidebarVisible ? '320px' : '0' }}>
              <div onClick={() => setIsGanttVisible(!isGanttVisible)} className="h-10 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-50 shrink-0">
                  <div className="flex items-center gap-3 text-gray-700">
                      <FontAwesomeIcon icon={faStream} className="text-blue-600" />
                      <span className="text-[11px] font-black uppercase tracking-widest italic">
                        Projeto em Foco: <span className="text-blue-600">{activeFile.nome_arquivo}</span>
                      </span>
                  </div>
                  <FontAwesomeIcon icon={isGanttVisible ? faChevronDown : faChevronUp} className="text-gray-400 text-xs" />
              </div>
              {isGanttVisible && <div className="flex-1 overflow-hidden"><GanttChart activities={activities} onEditActivity={() => {}} /></div>}
          </div>
      )}

      {/* MODAL DE ATIVIDADE */}
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