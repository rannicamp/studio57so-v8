import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export function useBimModels(viewerInstance, setIsGanttOpen, activeFiles) {
    const [loadedFiles, setLoadedFiles] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);
    
    const loadedModelsRef = useRef({});
    const globalOffsetRef = useRef(null);

    const didRestoreModelsRef = useRef(false);

    // ─── Auto-load retrospectivo dos modelos salvos (Validando contra ativos do banco) ───
    useEffect(() => {
        // Só rodamos o auto-load se o viewer estiver pronto e se tivermos os arquivos ativos do banco
        if (!viewerInstance || !activeFiles || activeFiles.length === 0 || didRestoreModelsRef.current) return;
        
        try {
            const saved = localStorage.getItem('bim_loadedFiles');
            if (saved) {
                const files = JSON.parse(saved);
                if (files && files.length > 0) {
                    // FILTRO PREVENTIVO: Mantém apenas arquivos que estão atualmente ativos e no banco
                    const activeFilesIds = activeFiles.map(af => af.id);
                    const validFiles = files.filter(f => activeFilesIds.includes(f.id));
                    
                    if (validFiles.length > 0) {
                        console.log('⚡ Devonildo: Restaurando modelos carregados anteriormente via auto-load (ativos):', validFiles);
                        // Dispara a carga em lote
                        handleLoadSet(validFiles);
                    } else {
                        // Se nenhum arquivo restaurado é ativo, limpa o localStorage
                        localStorage.removeItem('bim_loadedFiles');
                    }
                }
            }
        } catch (e) {
            console.error("Erro ao fazer auto-load de modelos do localStorage:", e);
        }
        
        didRestoreModelsRef.current = true;
    }, [viewerInstance, activeFiles]);

    // ─── Salva no localStorage quando a lista de carregados muda ───
    useEffect(() => {
        if (!didRestoreModelsRef.current) return;
        if (loadedFiles.length > 0) {
            localStorage.setItem('bim_loadedFiles', JSON.stringify(loadedFiles));
        } else {
            localStorage.removeItem('bim_loadedFiles');
        }
    }, [loadedFiles]);

    // Carregar/Descarregar Único Modelo
    const handleToggleModel = async (file) => {
        if (!viewerInstance) {
            console.error("❌ Devonildo diz: O Viewer ainda não foi iniciado!");
            return;
        }

        if (file?.is_lixeira) {
            console.warn("⚠️ Devonildo aviso: Tentativa de carregar arquivo da lixeira ignorada.");
            return;
        }

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
            console.log("📡 Devonildo tentando carregar URN:", fullUrn);

            const loadOptions = { 
                keepCurrentModels: true, 
                applyScaling: 'm', 
                placementTransform: new window.THREE.Matrix4(), 
                globalOffset: globalOffsetRef.current 
            };

            window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
                let viewables = doc.getRoot().getDefaultGeometry();
                if (!viewables) {
                    console.log("⚠️ Devonildo aviso: Vista padrão não encontrada, buscando geometrias 3D alternativas...");
                    const geom3d = doc.getRoot().search({ type: 'geometry', role: '3d' });
                    if (geom3d && geom3d.length > 0) {
                        viewables = geom3d[0];
                    } else {
                        console.log("⚠️ Devonildo aviso: Vista 3D não encontrada, buscando pranchas 2D...");
                        const geom2d = doc.getRoot().search({ type: 'geometry', role: '2d' });
                        if (geom2d && geom2d.length > 0) {
                            viewables = geom2d[0];
                        }
                    }
                }

                if (!viewables) {
                    console.error("❌ Devonildo erro: Nenhuma geometria visualizável encontrada no documento Autodesk.");
                    toast.error(`O arquivo ${file.nome_arquivo} não possui geometrias visualizáveis.`);
                    return;
                }

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
                    
                    viewerInstance.fitToView(); 
                    toast.success(`${file.nome_arquivo} carregado`);
                }, (err) => {
                    console.error("❌ Erro de Renderização Autodesk:", err);
                    toast.error("Erro ao renderizar modelo no navegador.");
                });
            }, (code, message, errors) => {
                console.error("❌ Erro ao acessar Documento Autodesk:", { code, message, errors });
                if (code === 403) {
                    toast.error("Acesso negado! Verifique se o domínio studio57.arq.br está authorized na Autodesk.");
                } else {
                    toast.error(`Falha Autodesk: ${message}`);
                }
            });
        }
    };

    const handleLoadSet = async (filesInSet) => {
        if (!viewerInstance) return;
        if (!filesInSet || filesInSet.length === 0) return toast.error("Conjunto vazio.");

        // Filtra para remover preventivamente qualquer arquivo marcado como lixeira
        const validFilesInSet = filesInSet.filter(f => !f.is_lixeira);
        if (validFilesInSet.length === 0) {
            toast.warning("Nenhum modelo ativo para carregar no conjunto.");
            return;
        }

        const newUrns = validFilesInSet.map(f => f.urn_autodesk.replace(/^urn:/, ''));
        const urnsToRemove = selectedModels.filter(urn => !newUrns.includes(urn));
        const filesToAdd = validFilesInSet.filter(f => !selectedModels.includes(f.urn_autodesk.replace(/^urn:/, '')));
        
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
                const loadOptions = { 
                    keepCurrentModels: true, 
                    applyScaling: 'm', 
                    placementTransform: new window.THREE.Matrix4(), 
                    globalOffset: globalOffsetRef.current 
                };

                window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
                    let viewables = doc.getRoot().getDefaultGeometry();
                    if (!viewables) {
                        const geom3d = doc.getRoot().search({ type: 'geometry', role: '3d' });
                        if (geom3d && geom3d.length > 0) {
                            viewables = geom3d[0];
                        } else {
                            const geom2d = doc.getRoot().search({ type: 'geometry', role: '2d' });
                            if (geom2d && geom2d.length > 0) {
                                viewables = geom2d[0];
                            }
                        }
                    }

                    if (!viewables) {
                        console.error(`❌ Devonildo erro: Nenhuma geometria visualizável encontrada para ${file.nome_arquivo}`);
                        resolve();
                        return;
                    }

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
        setLoadedFiles(validFilesInSet);
        setTimeout(() => { if (viewerInstance) viewerInstance.fitToView(); }, 500);
        toast.dismiss(toastId);
        toast.success("Conjunto carregado!");
    };

    const handleClearAll = () => {
        if (!viewerInstance) return;
        selectedModels.forEach(urn => {
            const model = loadedModelsRef.current[urn];
            if (model) viewerInstance.impl.unloadModel(model);
        });
        loadedModelsRef.current = {};
        globalOffsetRef.current = null;
        setSelectedModels([]);
        setLoadedFiles([]);
        viewerInstance.clearSelection();
        toast.success("Seleção limpa.");
    };

    return {
        loadedFiles,
        selectedModels,
        handleToggleModel,
        handleLoadSet,
        handleClearAll,
        loadedModelsRef 
    };
}