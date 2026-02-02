import { useState, useEffect, useRef } from 'react';

export function useBimViewer() {
    const [viewerInstance, setViewerInstance] = useState(null);
    const [selectedElements, setSelectedElements] = useState([]); 
    const [fastSelectionCount, setFastSelectionCount] = useState(0); 
    const [activeFile, setActiveFile] = useState(null);
    const [activeUrn, setActiveUrn] = useState(null);
    
    // Ref para evitar loops
    const isProcessingSelection = useRef(false);

    useEffect(() => {
        if (!viewerInstance) return;

        const onAggregateSelection = async (event) => {
            if (isProcessingSelection.current) return;
            
            try {
                // Pega a seleção de TODOS os modelos carregados
                const aggregateList = viewerInstance.getAggregateSelection();
                
                // Conta quantos itens no total
                const totalCount = aggregateList.reduce((acc, curr) => acc + curr.selection.length, 0);
                setFastSelectionCount(totalCount);

                // Se limpou a seleção, zera tudo
                if (totalCount === 0) {
                    setSelectedElements([]);
                    return;
                }

                isProcessingSelection.current = true;
                console.log(`🕵️ Devonildo Processando ${totalCount} itens...`);

                const promises = aggregateList.map(item => {
                    return new Promise((resolve) => {
                        // Tenta pegar o ID do projeto que anexamos no carregamento (useBimModels)
                        // Se não tiver, usa 'N/A'
                        const projetoBimId = item.model.studio57_context?.id || 'N/A';
                        const modelName = item.model.studio57_context?.nome || 'Modelo';

                        item.model.getBulkProperties(item.selection, ['externalId'], (props) => {
                            // AQUI É O PULO DO GATO: Criamos o OBJETO, não apenas o texto
                            const data = props.map(p => ({
                                externalId: p.externalId,
                                projetoBimId: projetoBimId,
                                modelName: modelName
                            }));
                            resolve(data);
                        }, (err) => {
                            console.error("Erro ao ler propriedades:", err);
                            resolve([]);
                        });
                    });
                });

                // Espera todos os modelos responderem e junta as listas
                const results = await Promise.all(promises);
                const allData = results.flat(); // Junta [[{obj1}], [{obj2}]] em [{obj1}, {obj2}]

                console.log("✅ Lista Final de Objetos:", allData);
                setSelectedElements(allData);

            } catch (error) {
                console.error("Erro crítico na seleção:", error);
            } finally {
                isProcessingSelection.current = false;
            }
        };

        viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
        
        return () => {
            if (viewerInstance) {
                viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
            }
        };
    }, [viewerInstance]);

    // Função auxiliar (mantém compatibilidade com botões antigos que esperam array de strings)
    const resolveSelection = (targetData, callback) => {
        if (!viewerInstance) {
            callback([targetData.externalId]);
            return;
        }
        if (selectedElements.length > 0) {
            // Mapeia de volta para apenas IDs se alguma função antiga pedir
            const idsOnly = selectedElements.map(el => el.externalId || el);
            callback(idsOnly);
        } else {
            callback([targetData.externalId]);
        }
    };

    return {
        viewerInstance,
        setViewerInstance,
        selectedElements,     
        setSelectedElements,
        fastSelectionCount,
        activeFile,
        activeUrn,
        resolveSelection
    };
}