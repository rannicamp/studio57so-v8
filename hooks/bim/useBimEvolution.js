'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export function useBimEvolution(viewer, organizacaoId) {
    const [isEvolutionMode, setIsEvolutionMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    // DEFINIÇÃO DAS CORES
    const getStatusColor = (status) => {
        const s = String(status).trim().toLowerCase().replace(' ', '_');
        if (!window.THREE) return null;

        switch (s) {
            case 'executado':
            case 'concluido':
                return new window.THREE.Vector4(0.1, 0.8, 0.1, 0.7); // Verde
            case 'em_andamento':
            case 'iniciado':
                return new window.THREE.Vector4(0.0, 0.4, 0.9, 0.7); // Azul
            case 'planejado':
            case 'nao_iniciado':
                return new window.THREE.Vector4(1.0, 0.6, 0.0, 0.6); // Laranja
            case 'atrasado':
            case 'bloqueado':
                return new window.THREE.Vector4(0.9, 0.1, 0.1, 0.7); // Vermelho
            default:
                return new window.THREE.Vector4(0.5, 0.5, 0.5, 0.3); // Cinza
        }
    };

    const toggleEvolutionMode = async () => {
        if (!viewer) {
            toast.error("Visualizador não iniciado.");
            return;
        }

        // 1. DESATIVAR
        if (isEvolutionMode) {
            viewer.clearThemingColors();
            viewer.showAll();
            setIsEvolutionMode(false);
            toast.info("Modo evolução desativado.");
            return;
        }

        // 2. ATIVAR
        setIsLoading(true);
        const toastId = toast.loading("Carregando evolução via URN...");

        try {
            // Passo A: Identificar quais URNs estão na tela
            const allModels = viewer.impl.modelQueue().getModels();
            
            // Extrai as URNs usando o contexto que salvamos no carregamento (useBimModels)
            // Isso garante que temos a URN exata do banco, não a derivada da Autodesk
            const urnsNaTela = allModels
                .map(m => m.studio57_context?.urn_autodesk)
                .filter(urn => urn); // Remove nulos

            if (urnsNaTela.length === 0) {
                throw new Error("Não foi possível identificar as URNs dos modelos carregados.");
            }

            console.log("🔍 [Devonildo] URNs detectadas na tela:", urnsNaTela);

            // Passo B: Buscar no Supabase filtrando POR URN (Sua ideia genial!)
            const { data: elementos, error } = await supabase
                .from('elementos_bim')
                .select('external_id, status_execucao, urn_autodesk')
                .eq('organizacao_id', organizacaoId)
                .in('urn_autodesk', urnsNaTela) // <--- O PULO DO GATO
                .not('status_execucao', 'is', null);

            if (error) throw error;

            if (!elementos || elementos.length === 0) {
                toast.dismiss(toastId);
                toast.warning("Nenhum status encontrado para os modelos atuais.");
                setIsLoading(false);
                return;
            }

            // Passo C: Agrupar dados por URN para acesso rápido
            // Cria um objeto tipo: { 'urn-1': { 'id-a': 'status' }, 'urn-2': ... }
            const mapPorUrn = {};
            
            elementos.forEach(el => {
                if (!mapPorUrn[el.urn_autodesk]) {
                    mapPorUrn[el.urn_autodesk] = {};
                }
                // Normaliza o ID para evitar erro de espaço/caps
                const cleanId = String(el.external_id).trim(); 
                mapPorUrn[el.urn_autodesk][cleanId] = el.status_execucao;
            });

            let totalPainted = 0;

            // Passo D: Pintar cada modelo usando SOMENTE os dados da sua URN
            for (const model of allModels) {
                const modelUrn = model.studio57_context?.urn_autodesk;
                const statusMap = mapPorUrn[modelUrn];

                if (!statusMap) continue; // Se não tem dados para esse modelo, pula

                await new Promise((resolve) => {
                    model.getExternalIdMapping((mapping) => {
                        // Varre o modelo e busca no mapa de status dessa URN específica
                        for (const externalId in mapping) {
                            const dbId = mapping[externalId];
                            
                            // Tenta achar o status (com trim por segurança)
                            const status = statusMap[String(externalId).trim()];
                            
                            if (status) {
                                const color = getStatusColor(status);
                                if (color) {
                                    viewer.setThemingColor(dbId, color, model);
                                    totalPainted++;
                                }
                            }
                        }
                        resolve();
                    });
                });
            }

            toast.dismiss(toastId);
            
            if (totalPainted > 0) {
                toast.success(`Sucesso! ${totalPainted} elementos atualizados.`);
                setIsEvolutionMode(true);
            } else {
                toast.warning("Dados carregados, mas nenhum elemento compatível foi encontrado.");
            }

        } catch (error) {
            console.error("Erro Evolução:", error);
            toast.dismiss(toastId);
            toast.error("Erro ao processar cores da evolução.");
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