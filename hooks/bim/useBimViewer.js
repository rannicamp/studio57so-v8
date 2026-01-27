import { useState, useEffect } from 'react';

export function useBimViewer() {
    const [viewerInstance, setViewerInstance] = useState(null);
    const [selectedElements, setSelectedElements] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [activeUrn, setActiveUrn] = useState(null);

    // Listener de Seleção (Ouvido do Viewer)
    useEffect(() => {
        if (!viewerInstance) return;

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
                        setActiveFile(fileData);
                        setActiveUrn(fileData.urn_autodesk.replace(/^urn:/, ''));
                        
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

        viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
        
        return () => {
            if (viewerInstance) {
                viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
            }
        };
    }, [viewerInstance]);

    // Helper para resolver seleção múltipla (usado por outros hooks)
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