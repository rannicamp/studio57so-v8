import { useState, useRef } from 'react';
import { toast } from 'sonner';

export function useBimModels(viewerInstance, setIsGanttOpen) {
    const [loadedFiles, setLoadedFiles] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);
    
    const loadedModelsRef = useRef({});
    const globalOffsetRef = useRef(null);

    // Carregar/Descarregar Único Modelo
    const handleToggleModel = async (file) => {
        if (!viewerInstance) return;

        const urnBancoLimpa = file.urn_autodesk.replace(/^urn:/, '');
        const isLoaded = selectedModels.includes(urnBancoLimpa);

        if (isLoaded) {
            // UNLOAD
            const modelToUnload = loadedModelsRef.current[urnBancoLimpa];
            if (modelToUnload) {
                viewerInstance.impl.unloadModel(modelToUnload);
                delete loadedModelsRef.current[urnBancoLimpa];

                const newSelectedModels = selectedModels.filter(u => u !== urnBancoLimpa);
                setSelectedModels(newSelectedModels);
                setLoadedFiles(prev => prev.filter(f => f.id !== file.id));

                if (newSelectedModels.length === 0) {
                    globalOffsetRef.current = null;
                }
                toast.success(`${file.nome_arquivo} fechado.`);
            }
        } else {
            // LOAD
            const fullUrn = `urn:${urnBancoLimpa}`;
            const loadOptions = { 
                keepCurrentModels: true, 
                applyScaling: 'm', 
                placementTransform: new THREE.Matrix4(), 
                globalOffset: globalOffsetRef.current 
            };

            window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
                const viewables = doc.getRoot().getDefaultGeometry();
                viewerInstance.loadModel(doc.getViewablePath(viewables), loadOptions, (model) => {
                    model.studio57_context = file;
                    loadedModelsRef.current[urnBancoLimpa] = model;
                    
                    if (!globalOffsetRef.current) {
                        globalOffsetRef.current = model.getData().globalOffset;
                    }

                    setSelectedModels(prev => [...prev, urnBancoLimpa]);
                    setLoadedFiles(prev => { 
                        if (prev.some(f => f.id === file.id)) return prev; 
                        return [...prev, file]; 
                    });

                    // Gantt automático removido (comportamento manual)
                    
                    viewerInstance.fitToView(); 
                    toast.success(`${file.nome_arquivo} carregado`);
                }, (err) => {
                    console.error("Erro ao carregar modelo:", err);
                    toast.error("Erro ao renderizar modelo.");
                });
            }, (code, message, errors) => {
                console.error("Erro ao carregar documento:", message);
                toast.error("Falha ao acessar o arquivo Autodesk.");
            });
        }
    };

    // Carregar Conjunto (Set)
    const handleLoadSet = async (filesInSet) => {
        if (!viewerInstance) return;
        if (!filesInSet || filesInSet.length === 0) return toast.error("Conjunto vazio.");

        const newUrns = filesInSet.map(f => f.urn_autodesk.replace(/^urn:/, ''));
        const urnsToRemove = selectedModels.filter(urn => !newUrns.includes(urn));
        const filesToAdd = filesInSet.filter(f => !selectedModels.includes(f.urn_autodesk.replace(/^urn:/, '')));
        
        const toastId = toast.loading("Carregando conjunto...");

        // Unload Excedentes
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

        // Load Novos (Sequencial)
        for (const file of filesToAdd) {
            await new Promise((resolve) => {
                const urn = file.urn_autodesk.replace(/^urn:/, '');
                const fullUrn = `urn:${urn}`;
                const loadOptions = { 
                    keepCurrentModels: true, 
                    applyScaling: 'm', 
                    placementTransform: new THREE.Matrix4(), 
                    globalOffset: globalOffsetRef.current 
                };

                window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
                    const viewables = doc.getRoot().getDefaultGeometry();
                    viewerInstance.loadModel(doc.getViewablePath(viewables), loadOptions, (model) => {
                        model.studio57_context = file;
                        loadedModelsRef.current[urn] = model;
                        if (!globalOffsetRef.current) globalOffsetRef.current = model.getData().globalOffset;
                        resolve();
                    }, (err) => { console.error(err); resolve(); });
                }, (err) => { console.error(err); resolve(); });
            });
        }

        setSelectedModels(newUrns);
        setLoadedFiles(filesInSet);

        setTimeout(() => {
            if (viewerInstance) viewerInstance.fitToView();
        }, 500);

        toast.dismiss(toastId);
        toast.success("Conjunto carregado!");
    };

    // --- NOVA FUNÇÃO: LIMPAR TUDO ---
    const handleClearAll = () => {
        if (!viewerInstance) return;

        // 1. Descarrega todos os modelos do Viewer
        selectedModels.forEach(urn => {
            const model = loadedModelsRef.current[urn];
            if (model) {
                viewerInstance.impl.unloadModel(model);
            }
        });

        // 2. Reseta os estados e referências
        loadedModelsRef.current = {};
        globalOffsetRef.current = null;
        setSelectedModels([]);
        setLoadedFiles([]);

        // 3. Limpa a seleção visual
        viewerInstance.clearSelection();
        
        toast.success("Seleção limpa.");
    };

    return {
        loadedFiles,
        selectedModels,
        handleToggleModel,
        handleLoadSet,
        handleClearAll, // <--- EXPORTADO AQUI
        loadedModelsRef 
    };
}