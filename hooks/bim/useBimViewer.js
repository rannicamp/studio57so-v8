import { useState, useEffect, useRef } from 'react';

export function useBimViewer() {
    const [viewerInstance, setViewerInstance] = useState(null);
    const [selectedElements, setSelectedElements] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [activeUrn, setActiveUrn] = useState(null);
    
    // Ref para evitar loops de listeners
    const listenerAdded = useRef(false);

    // Listener de Seleção (Ouvido do Viewer)
    useEffect(() => {
        if (!viewerInstance) return;

        // Função de tratamento do evento
        const onAggregateSelection = (event) => {
            const aggregateSelection = viewerInstance.getAggregateSelection();
            if (aggregateSelection && aggregateSelection.length > 0) {
                const selectionSet = aggregateSelection[0];
                const model = selectionSet.model;
                const dbIds = selectionSet.selection;

                if (model && dbIds.length > 0) {
                    const dbId = dbIds[dbIds.length - 1];
                    const fileData = model.studio57_context;

                    if (fileData) {
                        // Só atualiza se for diferente para evitar re-render
                        setActiveFile(prev => prev?.id === fileData.id ? prev : fileData);
                        setActiveUrn(prev => {
                            const newUrn = fileData.urn_autodesk.replace(/^urn:/, '');
                            return prev === newUrn ? prev : newUrn;
                        });
                        
                        // Pega o ExternalId para o Inspetor
                        model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (results) => {
                            if (results && results.length > 0) {
                                setSelectedElements([results[0].externalId]);
                            }
                        });
                    }
                }
            } else {
                setSelectedElements([]);
            }
        };

        // Adiciona o listener
        viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
        
        // Limpeza (Crucial para não travar)
        return () => {
            if (viewerInstance) {
                viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
            }
        };
    }, [viewerInstance]); // Dependência correta

    // Helper para resolver seleção múltipla
    const resolveSelection = (targetData, callback) => {
        if (!viewerInstance) {
            callback([targetData.externalId]);
            return;
        }
        const currentSelection = viewerInstance.getSelection();

        if (currentSelection.length > 1) {
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
        activeFile,
        activeUrn,
        resolveSelection
    };
}