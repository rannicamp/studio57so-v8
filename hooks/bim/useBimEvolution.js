'use client';

import { useState } from 'react';
// CORREÇÃO: Usando @ para garantir que o import funcione em qualquer pasta
import { createClient } from '@/utils/supabase/client'; 
import { toast } from 'sonner';

export function useBimEvolution(viewer, organizacaoId) {
    const [isEvolutionMode, setIsEvolutionMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const toggleEvolutionMode = async () => {
        if (!viewer) return;

        // 1. DESATIVAR
        if (isEvolutionMode) {
            viewer.clearThemingColors();
            viewer.showAll();
            setIsEvolutionMode(false);
            toast.info("Modo Evolução desativado.");
            return;
        }

        // 2. ATIVAR
        setIsLoading(true);
        try {
            console.log("🔍 Iniciando busca de evolução...");

            const { data: elementos, error } = await supabase
                .from('elementos_bim')
                .select('external_id, status_execucao')
                .eq('organizacao_id', organizacaoId)
                .not('status_execucao', 'is', null);

            if (error) throw error;

            if (!elementos || elementos.length === 0) {
                toast.warning("Nenhum status registrado no banco.");
                setIsLoading(false);
                return;
            }

            // Garante acesso ao THREE global do Viewer
            const THREE = window.THREE;
            if (!THREE) {
                toast.error("Visualizador não inicializado corretamente.");
                setIsLoading(false);
                return;
            }

            // Definição das Cores
            const colors = {
                'concluido': new THREE.Vector4(0, 0.8, 0.2, 0.7),     // Verde
                'em_andamento': new THREE.Vector4(0, 0.4, 1, 0.7),    // Azul
                'pausado': new THREE.Vector4(1, 0.5, 0, 0.7),         // Laranja
                'nao_iniciado': new THREE.Vector4(0.8, 0.8, 0.8, 0.5) // Cinza
            };

            viewer.clearThemingColors();
            const allModels = viewer.impl.modelQueue().getModels();
            
            // Mapa para busca rápida (Normalizado)
            const statusMap = new Map();
            elementos.forEach(el => {
                if(el.external_id) {
                    statusMap.set(String(el.external_id).trim().toLowerCase(), el.status_execucao);
                }
            });

            let paintedCount = 0;

            allModels.forEach(model => {
                model.getExternalIdMapping((mapping) => {
                    for (const externalId in mapping) {
                        const normalizedId = String(externalId).trim().toLowerCase();
                        const status = statusMap.get(normalizedId);

                        if (status && colors[status]) {
                            const dbId = mapping[externalId];
                            viewer.setThemingColor(dbId, colors[status], model);
                            paintedCount++;
                        }
                    }
                });
            });

            if (paintedCount === 0) {
                toast.warning(`0 elementos coloridos (Banco: ${elementos.length}). Verifique IDs.`);
            } else {
                toast.success(`Evolução ativa: ${paintedCount} elementos.`);
            }
            
            setIsEvolutionMode(true);

        } catch (error) {
            console.error("Erro evolução:", error);
            toast.error("Erro ao carregar evolução.");
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isEvolutionMode,
        isLoadingEvolution: isLoading,
        toggleEvolutionMode
    };
}