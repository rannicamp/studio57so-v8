// Caminho: app/(bim)/bim-manager/page.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimProperties from '@/components/bim/BimProperties';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import GanttChart from '@/components/atividades/GanttChart'; 
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

  // Busca de dados básicos
  const { data: auxData } = useQuery({
      queryKey: ['bimAuxData', organizacao_id],
      queryFn: async () => {
          const { data } = await supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacao_id);
          return { empreendimentos: data || [] };
      },
      enabled: !!organizacao_id
  });

  // --- FUNÇÃO DE EXTRAÇÃO DE DADOS (O QUE FALTAVA) ---
  const handleSelectContext = useCallback(async (context) => {
    if (context.type === 'sync') {
      const { file } = context;
      const toastId = toast.loading(`Extraindo dados de: ${file.nome_arquivo}...`);
      
      try {
        // Chamada para a sua API ou Função de Extração
        // Aqui simulamos a busca dos elementos no Viewer e salvamento
        if (!viewerInstance) throw new Error("Viewer não inicializado");

        // Buscamos o modelo correto no viewer
        const cleanUrn = file.urn_autodesk.replace(/^urn:/, '');
        const model = loadedModelsRef.current[cleanUrn];

        if (!model) {
            toast.error("Por favor, carregue o modelo na tela antes de sincronizar.");
            toast.dismiss(toastId);
            return;
        }

        // 1. Pegar todos os IDs do modelo
        model.getObjectTree((tree) => {
            const allDbIds = [];
            tree.enumNodeChildren(tree.getRootId(), (dbId) => {
                allDbIds.push(dbId);
            }, true);

            // 2. Buscar propriedades em lote (Bulk)
            model.getBulkProperties(allDbIds, { propFilter: ['externalId', 'category'] }, async (results) => {
                const elementosParaSalvar = results.map(res => ({
                    organizacao_id,
                    projeto_bim_id: file.id,
                    external_id: res.externalId,
                    categoria: res.properties?.[0]?.displayValue || 'Desconhecido',
                    urn_autodesk: cleanUrn,
                    propriedades: {}, // Começa vazio para o Studio 57
                    atualizado_em: new Date()
                }));

                // 3. Salva no Supabase (Upsert para não duplicar)
                const { error } = await supabase
                    .from('elementos_bim')
                    .upsert(elementosParaSalvar, { onConflict: 'projeto_bim_id, external_id' });

                if (error) throw error;

                toast.success(`${file.nome_arquivo} sincronizado com sucesso!`, { id: toastId });
                queryClient.invalidateQueries(['bimElementProperties']);
            });
        });

      } catch (error) {
        console.error("Erro na extração:", error);
        toast.error("Falha na extração: " + error.message, { id: toastId });
      }
    }
  }, [viewerInstance, organizacao_id, queryClient, supabase]);

  // SELEÇÃO DE ELEMENTOS
  const handleSelection = useCallback((dbIdArray, urnDoViewer, model) => {
    if (dbIdArray.length > 0 && model) {
        const rawUrn = model.getDocumentNode()?.getDocument()?.urn() || model.getData().urn;
        const cleanUrn = rawUrn.replace(/^urn:/, '');
        
        const file = filesMapRef.current[cleanUrn] || Object.values(filesMapRef.current).find(f => f.urn_autodesk.includes(cleanUrn));

        if (file) {
            setActiveFile(file);
            setActiveUrn(cleanUrn);
            
            model.getBulkProperties(dbIdArray, { propFilter: ['externalId'] }, (results) => {
                if (results && results.length > 0) {
                    const extId = results[0].externalId;
                    setSelectedElements([extId]);
                    queryClient.invalidateQueries(['bimElementProperties']);
                }
            });
        }
    } else {
        setSelectedElements([]);
    }
  }, [queryClient]);

  const handleToggleModel = async (file) => {
    if (!viewerInstance) return;
    const urnLimpa = file.urn_autodesk.replace(/^urn:/, '');
    const isLoaded = selectedModels.includes(urnLimpa);

    if (isLoaded) {
        const modelToUnload = loadedModelsRef.current[urnLimpa];
        if (modelToUnload) {
            viewerInstance.impl.unloadModel(modelToUnload);
            delete loadedModelsRef.current[urnLimpa];
            delete filesMapRef.current[urnLimpa];
            setSelectedModels(prev => prev.filter(u => u !== urnLimpa));
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
                toast.success(`${file.nome_arquivo} pronto`);
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
                    const clean = f.urn_autodesk.replace(/^urn:/, '');
                    filesMapRef.current[clean] = f;
                    if(!selectedModels.includes(clean)) handleToggleModel(f);
                    setActiveFile(f);
                    setActiveUrn(clean);
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
                    onSelectionChange={handleSelection}
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