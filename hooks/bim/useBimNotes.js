// Caminho: hooks/bim/useBimNotes.js
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';

export function useBimNotes(viewerInstance, activeFile) {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteCaptureData, setNoteCaptureData] = useState(null);

    // Abrir Modal de Criação (Captura Detalhada com Projeto por Elemento)
    const handleOpenNoteCreation = async (targetData) => {
        if (!viewerInstance) return;

        let determinedProjectId = activeFile?.id;
        let finalElements = []; // Lista de Objetos { externalId, projectId }
        let primaryModel = null;   

        const cameraState = viewerInstance.getState({ viewport: true });
        const aggregateSelection = viewerInstance.getAggregateSelection();

        // 1. Captura via Seleção (Múltiplos Modelos)
        if (aggregateSelection.length > 0) {
            for (const selectionGroup of aggregateSelection) {
                const model = selectionGroup.model;
                const dbIds = selectionGroup.selection;
                
                // Pega o ID do projeto deste modelo específico
                // Se o modelo não tiver contexto (ex: carregado via link externo), tenta usar o activeFile como fallback
                const modelProjectId = model.studio57_context?.id || activeFile?.id;

                if (!primaryModel) primaryModel = model;

                await new Promise((resolve) => {
                    model.getBulkProperties(dbIds, ['externalId'], (props) => {
                        const newElements = props.map(p => ({
                            externalId: p.externalId,
                            projectId: modelProjectId // Salva o projeto correto de CADA elemento
                        }));
                        finalElements = [...finalElements, ...newElements];
                        resolve();
                    }, (err) => {
                        console.error("Erro properties:", err);
                        resolve();
                    });
                });
            }

            if (primaryModel?.studio57_context?.id) {
                determinedProjectId = primaryModel.studio57_context.id;
            }

        } 
        // 2. Captura via Clique Direito (Fallback)
        else if (targetData?.externalId) {
            const modelProjectId = targetData.model?.studio57_context?.id || activeFile?.id;
            finalElements = [{ 
                externalId: targetData.externalId, 
                projectId: modelProjectId 
            }];
            
            if (modelProjectId) determinedProjectId = modelProjectId;
        }

        if (!determinedProjectId) {
            toast.error("Projeto não identificado. Selecione um elemento visível.");
            return;
        }

        if (finalElements.length === 0) {
            toast.warning("Nenhum elemento válido foi capturado.");
            return;
        }

        // Screenshot
        viewerInstance.getScreenShot(800, 600, (blobUrl) => {
            fetch(blobUrl)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setNoteCaptureData({
                            cameraState,
                            snapshot: reader.result,
                            elements: finalElements, // Novo Formato Rico
                            elementIds: finalElements.map(e => e.externalId), // Retrocompatibilidade
                            projetoBimId: determinedProjectId
                        });
                        setIsNoteModalOpen(true);
                    };
                    reader.readAsDataURL(blob);
                });
        });
    };

    // Restaurar Nota (Agora com Hack Anti-Crash e Lógica de Projeto)
    const handleRestoreNote = async (note) => {
        if (!viewerInstance) return;

        try {
            // 1. Busca Vínculos
            const { data: vinculos } = await supabase
                .from('bim_notas_elementos')
                .select('external_id, projeto_bim_id')
                .eq('nota_id', note.id);

            if (!vinculos || vinculos.length === 0) {
                if (note.camera_state) restoreCamera(note.camera_state);
                return;
            }

            // 2. Agrupa elementos por Projeto ID (para saber em qual modelo buscar)
            const elementsByProject = {};
            vinculos.forEach(v => {
                const pid = v.projeto_bim_id;
                const cleanId = String(v.external_id).trim(); // Higiene básica
                if (!elementsByProject[pid]) elementsByProject[pid] = [];
                elementsByProject[pid].push(cleanId);
            });

            const allModels = viewerInstance.impl.modelQueue().getModels();
            let selectionCandidates = [];
            
            // 3. Monta candidatos de seleção varrendo os modelos
            for (const model of allModels) {
                const modelProjectId = model.studio57_context?.id;
                
                // Se o modelo tem ID e existem elementos da nota para esse projeto...
                if (modelProjectId && elementsByProject[modelProjectId]) {
                    const targetIds = elementsByProject[modelProjectId];

                    await new Promise((resolve) => {
                        model.getExternalIdMapping((mapping) => {
                            const dbIdsInThisModel = [];
                            
                            targetIds.forEach(extId => {
                                const dbId = mapping[extId];
                                // Validação estrita para evitar array com 'undefined'
                                if (typeof dbId === 'number') {
                                    dbIdsInThisModel.push(dbId);
                                }
                            });

                            // SÓ adiciona se tiver itens válidos
                            if (dbIdsInThisModel.length > 0) {
                                selectionCandidates.push({
                                    model: model,
                                    selection: dbIdsInThisModel,
                                    ids: dbIdsInThisModel // <--- VOLTANDO O HACK! (Isso previne o crash)
                                });
                            }
                            resolve();
                        });
                    });
                }
            }

            // 4. Aplica a Seleção e Câmera
            if (selectionCandidates.length > 0) {
                
                // A. Restaura Câmera (Primeiro, para garantir posição)
                if (note.camera_state) {
                    restoreCamera(note.camera_state);
                }

                // B. Aplica Seleção
                if (selectionCandidates.length === 1) {
                    // Caso simples: 1 modelo
                    const c = selectionCandidates[0];
                    viewerInstance.select(c.selection, c.model);
                    
                    // Se NÃO tem câmera salva, foca no objeto. Se tem, respeita a foto.
                    if (!note.camera_state) {
                        viewerInstance.fitToView(c.selection, c.model);
                    }
                } else {
                    // Caso complexo: Vários modelos (Aggregate)
                    // O 'ids' extra ali em cima garante que isso não crashe
                    viewerInstance.setAggregateSelection(selectionCandidates);
                    
                    if (!note.camera_state) {
                         viewerInstance.fitToView();
                    }
                }
                
                toast.success(`${vinculos.length} elementos destacados.`);
            } else {
                // Se não achou ninguém (modelos fechados?)
                if (note.camera_state) {
                    restoreCamera(note.camera_state);
                    toast.warning("Vista restaurada. Elementos não encontrados nos modelos abertos.");
                }
            }

        } catch (error) {
            console.error("Erro restoreNote:", error);
            toast.error("Erro técnico ao restaurar elementos.");
        }
    };

    const restoreCamera = (cameraState) => {
        if (!viewerInstance || !cameraState) return;
        try {
            const state = typeof cameraState === 'string' ? JSON.parse(cameraState) : cameraState;
            viewerInstance.restoreState(state);
        } catch (e) {
            console.error("Erro cam:", e);
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