import { useState, useEffect, useRef } from 'react';

export function useBimViewer() {
    const [viewerInstance, setViewerInstance] = useState(null);
    const [selectedElements, setSelectedElements] = useState([]);
    const [fastSelectionCount, setFastSelectionCount] = useState(0); // O Contador Rápido
    const [activeFile, setActiveFile] = useState(null);
    const [activeUrn, setActiveUrn] = useState(null);
    
    // Ref para evitar loops de listeners
    const listenerAdded = useRef(false);

    // Listener de Seleção (Ouvido do Viewer)
    useEffect(() => {
        if (!viewerInstance) return;

        // Função de tratamento do evento
        const onAggregateSelection = (event) => {
            // --- A LIÇÃO APRENDIDA (CORREÇÃO BASEADA NA SUA PESQUISA) ---
            // Em vez de .getSelection() que falha em multi-modelos, 
            // usamos .getAggregateSelection() que varre tudo.
            const aggregateList = viewerInstance.getAggregateSelection();
            
            // Soma a quantidade de itens selecionados em TODOS os modelos carregados
            const totalCount = aggregateList.reduce((acc, curr) => acc + curr.selection.length, 0);
            
            // Atualiza o contador instantaneamente
            setFastSelectionCount(totalCount);

            // --- Lógica de Dados (Mantida para Propriedades) ---
            if (aggregateList && aggregateList.length > 0) {
                // Pega o último item clicado para mostrar as propriedades
                const lastSelection = aggregateList[0]; 
                const model = lastSelection.model;
                const dbIds = lastSelection.selection;

                if (model && dbIds.length > 0) {
                    const dbId = dbIds[0]; // Pega o primeiro ID do grupo
                    
                    // 1. Tenta pegar metadados do arquivo (se houver)
                    const fileData = model.studio57_context;
                    if (fileData) {
                        setActiveFile(prev => prev?.id === fileData.id ? prev : fileData);
                        setActiveUrn(prev => {
                            const newUrn = fileData.urn_autodesk.replace(/^urn:/, '');
                            return prev === newUrn ? prev : newUrn;
                        });
                    }

                    // 2. Busca o ID externo
                    model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (results) => {
                        if (results && results.length > 0) {
                            const idToUse = results[0].externalId || String(results[0].dbId);
                            setSelectedElements([idToUse]);
                        }
                    }, (err) => {
                        console.error("Erro ao buscar propriedades:", err);
                    });
                }
            } else {
                // Se clicou no vazio
                setSelectedElements([]);
                setFastSelectionCount(0);
            }
        };

        // Adiciona o listener para MUDANÇA AGREGADA (O evento correto para multi-model)
        viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
        
        // Limpeza
        return () => {
            if (viewerInstance) {
                viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
            }
        };
    }, [viewerInstance]);

    // Helper para resolver seleção múltipla
    const resolveSelection = (targetData, callback) => {
        if (!viewerInstance) {
            callback([targetData.externalId]);
            return;
        }
        // Aqui também atualizamos para usar a lógica agregada se precisar no futuro
        const currentSelection = viewerInstance.getSelection();
        if (currentSelection.length > 0) {
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

    return {
        viewerInstance,
        setViewerInstance,
        selectedElements,
        setSelectedElements,
        fastSelectionCount, // Exportando o contador corrigido
        activeFile,
        activeUrn,
        resolveSelection
    };
}