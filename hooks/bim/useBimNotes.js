// Caminho: hooks/bim/useBimNotes.js
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useBimNotes(viewerInstance, activeFile) {
    const queryClient = useQueryClient();
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteCaptureData, setNoteCaptureData] = useState(null);

    // Abrir Modal de Criação (Snapshot)
    const handleOpenNoteCreation = (targetData) => {
        if (!viewerInstance) return;

        const cameraState = viewerInstance.getState({ viewport: true });
        
        // Screenshot
        viewerInstance.getScreenShot(800, 600, (blobUrl) => {
            fetch(blobUrl)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result;
                        setNoteCaptureData({
                            cameraState,
                            snapshot: base64data,
                            elementId: targetData?.externalId,
                            projetoBimId: activeFile?.id 
                        });
                        setIsNoteModalOpen(true);
                    };
                    reader.readAsDataURL(blob);
                });
        });
    };

    // Restaurar Nota (Lógica de Zoom)
    const handleRestoreNote = async (note) => {
        if (!viewerInstance) return;

        console.log("Tentando restaurar nota:", note.titulo); // Debug

        // 1. Elemento Vinculado (Prioridade)
        if (note.elemento_vinculado_id) {
            const extId = note.elemento_vinculado_id;
            const allModels = viewerInstance.impl.modelQueue().getModels();
            let found = false;

            for (const model of allModels) {
                await new Promise((resolve) => {
                    model.getExternalIdMapping((mapping) => {
                        if (mapping[extId]) {
                            const dbId = mapping[extId];
                            
                            // Restaura camera state se houver (para ângulo)
                            if (note.camera_state) {
                                try {
                                    const state = typeof note.camera_state === 'string' ? JSON.parse(note.camera_state) : note.camera_state;
                                    viewerInstance.restoreState(state);
                                } catch(e) {}
                            }

                            // Select e Zoom (Fit To View é crucial aqui)
                            viewerInstance.select(dbId, model);
                            viewerInstance.fitToView([dbId], model); 
                            found = true;
                        }
                        resolve();
                    });
                });
                if (found) break;
            }

            if (found) {
                toast.success("Elemento localizado.");
                return;
            } else {
                toast.warning("Elemento não encontrado. Restaurando câmera.");
            }
        }
        
        // 2. Apenas Câmera (Sem elemento ou não achou)
        if (note.camera_state) {
            try {
                const state = typeof note.camera_state === 'string' ? JSON.parse(note.camera_state) : note.camera_state;
                viewerInstance.restoreState(state);
                toast.success("Vista restaurada.");
            } catch (e) {
                toast.error("Erro ao restaurar vista.");
            }
        }
    };

    return {
        isNoteModalOpen,
        setIsNoteModalOpen,
        noteCaptureData,
        handleOpenNoteCreation,
        handleRestoreNote, // <--- ESTA LINHA É OBRIGATÓRIA
        onNoteSuccess: () => {
            queryClient.invalidateQueries(['bimNotes']);
            toast.success("Nota salva!");
        }
    };
}