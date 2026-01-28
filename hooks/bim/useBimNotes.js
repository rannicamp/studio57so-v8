// Caminho: hooks/bim/useBimNotes.js
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

export function useBimNotes(viewerInstance, activeFile) {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteCaptureData, setNoteCaptureData] = useState(null);

    // Abrir Modal de Criação (Captura Seleção Múltipla)
    const handleOpenNoteCreation = async (targetData) => {
        if (!viewerInstance) return;

        const cameraState = viewerInstance.getState({ viewport: true });
        
        // Pegamos a seleção atual do Viewer
        const aggregateSelection = viewerInstance.getAggregateSelection();
        let selectedExternalIds = [];

        if (aggregateSelection.length > 0) {
            const selection = aggregateSelection[0];
            const model = selection.model;
            const dbIds = selection.selection;

            // Transformamos DBIDs em ExternalIDs (IDs do Revit)
            await new Promise((resolve) => {
                model.getBulkProperties(dbIds, ['externalId'], (props) => {
                    selectedExternalIds = props.map(p => p.externalId);
                    resolve();
                }, resolve);
            });
        }

        // Se não selecionou nada mas clicou num elemento específico
        if (selectedExternalIds.length === 0 && targetData?.externalId) {
            selectedExternalIds = [targetData.externalId];
        }

        // Screenshot para a nota
        viewerInstance.getScreenShot(800, 600, (blobUrl) => {
            fetch(blobUrl)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setNoteCaptureData({
                            cameraState,
                            snapshot: reader.result,
                            elementIds: selectedExternalIds, // <--- Lista de IDs
                            projetoBimId: activeFile?.id 
                        });
                        setIsNoteModalOpen(true);
                    };
                    reader.readAsDataURL(blob);
                });
        });
    };

    // Restaurar Nota (Lógica de Zoom Coletivo)
    const handleRestoreNote = async (note) => {
        if (!viewerInstance) return;

        // Buscamos os elementos vinculados na tabela nova
        const { data: vinculos } = await supabase
            .from('bim_notas_elementos')
            .select('external_id')
            .eq('nota_id', note.id);

        const externalIds = vinculos?.map(v => v.external_id) || [];

        if (externalIds.length > 0) {
            const allModels = viewerInstance.impl.modelQueue().getModels();
            let allDbIds = [];
            let targetModel = null;

            for (const model of allModels) {
                await new Promise((resolve) => {
                    model.getExternalIdMapping((mapping) => {
                        externalIds.forEach(extId => {
                            if (mapping[extId]) {
                                allDbIds.push(mapping[extId]);
                                targetModel = model;
                            }
                        });
                        resolve();
                    });
                });
            }

            if (allDbIds.length > 0) {
                // Restaura a câmera original da nota se houver
                if (note.camera_state) {
                    const state = typeof note.camera_state === 'string' ? JSON.parse(note.camera_state) : note.camera_state;
                    viewerInstance.restoreState(state);
                }
                
                viewerInstance.select(allDbIds, targetModel);
                viewerInstance.fitToView(allDbIds, targetModel);
                toast.success(`${allDbIds.length} elementos localizados.`);
                return;
            }
        }
        
        // Fallback: Apenas Câmera
        if (note.camera_state) {
            const state = typeof note.camera_state === 'string' ? JSON.parse(note.camera_state) : note.camera_state;
            viewerInstance.restoreState(state);
            toast.success("Vista restaurada.");
        }
    };

    return {
        isNoteModalOpen,
        setIsNoteModalOpen,
        noteCaptureData,
        handleOpenNoteCreation,
        handleRestoreNote,
        onNoteSuccess: () => {
            queryClient.invalidateQueries(['bimNotes']);
            toast.success("Nota salva!");
        }
    };
}