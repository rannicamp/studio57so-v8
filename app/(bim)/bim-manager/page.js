// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
// IMPORTANTE: Importamos o extrator corrigido
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
  const [selectedModels, setSelectedModels] = useState([]); 

  const loadedModelsRef = useRef({}); 

  // --- ESCUTAR CLIQUES (COM O MÉTODO RANNIERE) ---
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
                // Injeção de Contexto (Método Ranniere)
                model.studio57_context = file;
                loadedModelsRef.current[urnBancoLimpa] = model;
                setSelectedModels(prev => [...prev, urnBancoLimpa]);
                toast.success(`${file.nome_arquivo} carregado`);
            });
        });
    }
  };

  // --- EXTRAÇÃO DE DADOS (AGORA USANDO O EXTRATOR EXTERNO CORRIGIDO) ---
  const handleSelectContext = useCallback(async (context) => {
    if (context.type === 'sync') {
      const { file } = context;
      const toastId = toast.loading(`Iniciando extração de: ${file.nome_arquivo}...`);
      
      try {
        if (!viewerInstance) throw new Error("Viewer não inicializado");

        const cleanUrn = file.urn_autodesk.replace(/^urn:/, '');
        const model = loadedModelsRef.current[cleanUrn];

        if (!model) {
            toast.error("Carregue o modelo na tela antes de sincronizar.", { id: toastId });
            return;
        }

        // Chama a função externa que arrumamos
        await extrairDadosDoModelo(
            model, 
            file.id, 
            organizacao_id, 
            (progresso) => {
                // Opcional: Atualizar mensagem de progresso se quiser
                // toast.loading(`Extraindo... ${progresso}%`, { id: toastId });
            }
        );

        toast.success(`${file.nome_arquivo} sincronizado com sucesso!`, { id: toastId });
        queryClient.invalidateQueries(['bimElementProperties']);

      } catch (error) {
        console.error("Erro na extração:", error);
        toast.error("Falha: " + error.message, { id: toastId });
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
            <div className="flex-1 relative h-full">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                    </button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                        <FontAwesomeIcon icon={faHome} />
                    </Link>
                </div>

                <AutodeskViewerAPI 
                    urn={null} 
                    onViewerReady={(v) => setViewerInstance(v)}
                />
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