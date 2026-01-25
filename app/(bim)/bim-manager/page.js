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
import { faChevronLeft, faChevronRight, faHome, faStream, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function BimManagerPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id } = useAuth();

  const [activeFile, setActiveFile] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [viewerInstance, setViewerInstance] = useState(null);
  const [isGanttVisible, setIsGanttVisible] = useState(false); 
  const [selectedElements, setSelectedElements] = useState([]); 
  const [selectedModels, setSelectedModels] = useState([]); 

  const loadedModelsRef = useRef({}); 
  const filesMapRef = useRef({}); 

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

  const { data: activities = [] } = useQuery({
      queryKey: ['atividades_bim', activeFile?.empreendimento_id, organizacao_id],
      queryFn: async () => {
          if (!activeFile?.empreendimento_id) return [];
          const { data } = await supabase.from('activities').select('*').eq('empreendimento_id', activeFile.empreendimento_id).eq('organizacao_id', organizacao_id).order('data_inicio_prevista');
          return data || [];
      },
      enabled: !!activeFile?.empreendimento_id
  });

  // --- SELEÇÃO INTELIGENTE (DETECTOR DE DNA) ---
  const handleSelection = useCallback((dbIdArray, urnDoViewer, model) => {
    if (dbIdArray.length > 0 && urnDoViewer && model) {
        // A URN que vem do viewer pode ter o prefixo, no mapa salvamos LIMPA
        const cleanUrn = urnDoViewer.replace('urn:', '');
        const file = filesMapRef.current[cleanUrn];

        if (file) {
            setActiveFile(file);
            setActiveUrn(cleanUrn);
            
            model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
                if (results && results.length > 0) {
                    const extId = results[0].externalId;
                    setSelectedElements([extId]);
                    // Notificamos o cache que mudou o elemento para forçar o componente a atualizar
                    queryClient.invalidateQueries(['bimElementProperties', extId, cleanUrn]);
                }
            });
        }
    } else {
        setSelectedElements([]);
    }
  }, [queryClient]);

  // --- MESCLAGEM DE MODELOS ---
  const handleToggleModel = async (file) => {
    if (!viewerInstance) return;
    const urnLimpa = file.urn_autodesk.replace('urn:', '');
    const isLoaded = selectedModels.includes(urnLimpa);

    if (isLoaded) {
        const modelToUnload = loadedModelsRef.current[urnLimpa];
        if (modelToUnload) {
            viewerInstance.impl.unloadModel(modelToUnload);
            delete loadedModelsRef.current[urnLimpa];
            delete filesMapRef.current[urnLimpa];
            setSelectedModels(prev => prev.filter(u => u !== urnLimpa));
            if (activeUrn === urnLimpa) {
                setActiveFile(null);
                setSelectedElements([]);
            }
        }
    } else {
        const fullUrn = `urn:${urnLimpa}`;
        window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewerInstance.loadModel(doc.getViewablePath(viewables), { 
                keepCurrentModels: true,
                modelNameOverride: file.nome_arquivo 
            }, (model) => {
                loadedModelsRef.current[urnLimpa] = model;
                filesMapRef.current[urnLimpa] = file; 
                setSelectedModels(prev => [...prev, urnLimpa]);
                toast.success(`Mesclado: ${file.nome_arquivo}`);
            });
        });
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col font-sans">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
            <BimSidebar 
                onFileSelect={(f) => { 
                    const clean = f.urn_autodesk.replace('urn:', '');
                    setActiveFile(f); 
                    setActiveUrn(clean);
                    filesMapRef.current[clean] = f; 
                    if(!selectedModels.includes(clean)) handleToggleModel(f);
                }} 
                onToggleModel={handleToggleModel}
                selectedModels={selectedModels}
                activeUrn={activeUrn} 
            />
        </div>

        <main className="flex-1 h-full relative flex min-w-0">
            <div className="flex-1 relative h-full">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border hover:bg-white transition-all"><FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} /></button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all"><FontAwesomeIcon icon={faHome} /></Link>
                </div>

                <AutodeskViewerAPI 
                    urn={null} 
                    onSelectionChange={handleSelection}
                    onViewerReady={(v) => setViewerInstance(v)}
                />
            </div>

            {/* BARRA DE PROPRIEDADES - AGORA SEM TRAVAS RÍGIDAS */}
            {selectedElements.length > 0 && activeUrn && (
                <BimProperties 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile?.id}
                    urnAutodesk={activeUrn} 
                    onClose={() => setSelectedElements([])} 
                />
            )}
        </main>
      </div>

      {activeFile && (
          <div className={`fixed bottom-0 left-0 right-0 bg-white border-t transition-all duration-500 flex flex-col z-[70] shadow-2xl ${isGanttVisible ? 'h-[45vh]' : 'h-10'}`} style={{ left: isSidebarVisible ? '320px' : '0' }}>
              <div onClick={() => setIsGanttVisible(!isGanttVisible)} className="h-10 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-50 shrink-0">
                  <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faStream} className="text-blue-600" />
                      <span className="text-[11px] font-black uppercase tracking-widest italic text-gray-700">Foco: {activeFile.nome_arquivo}</span>
                  </div>
                  <FontAwesomeIcon icon={isGanttVisible ? faChevronDown : faChevronUp} className="text-gray-400 text-xs" />
              </div>
              {isGanttVisible && <div className="flex-1 overflow-hidden"><GanttChart activities={activities} onEditActivity={() => {}} /></div>}
          </div>
      )}
    </div>
  );
}