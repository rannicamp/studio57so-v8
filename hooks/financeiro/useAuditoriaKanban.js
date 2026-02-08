// hooks/financeiro/useAuditoriaKanban.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros'; 

export function useAuditoriaKanban({ filters }) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const organizacaoId = user?.organizacao_id;

    // 1. O Porteiro: Padroniza os filtros usando a lógica central do sistema
    const filtrosPadronizados = formatarFiltrosParaBanco(filters);

    const queryKey = ['auditoriaKanban', organizacaoId, filtrosPadronizados];

    const { data, isLoading, error } = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            if (!organizacaoId) return null;

            // 2. Chama a função SQL existente
            const { data, error } = await supabase.rpc('get_dashboard_auditoria_kanban', {
                p_organizacao_id: organizacaoId,
                p_filtros: filtrosPadronizados 
            });

            if (error) {
                console.error("Erro no Kanban de Auditoria:", error);
                throw error;
            }
            return data;
        },
        enabled: !!organizacaoId,
        staleTime: Infinity, 
    });

    // Função para atualização otimista (UI rápida ao mover cards)
    const updateLocalKanban = (lancamentoId, novoStatus) => {
        queryClient.setQueryData(queryKey, (oldData) => {
            if (!oldData) return oldData;

            // Procura o item nas listas
            let item = oldData.fila_ia.find(i => i.id === lancamentoId) || 
                       oldData.divergente.find(i => i.id === lancamentoId);
            
            if (!item) return oldData;

            const updatedItem = { ...item, status_auditoria_ia: novoStatus };

            // Remove da origem
            const novaFilaIa = oldData.fila_ia.filter(i => i.id !== lancamentoId);
            const novoDivergente = oldData.divergente.filter(i => i.id !== lancamentoId);
            const novoAprovado = oldData.aprovado.filter(i => i.id !== lancamentoId);

            // Adiciona no destino
            let finalDivergente = novoDivergente;
            let finalAprovado = novoAprovado;

            if (novoStatus === 'Aprovado') {
                finalAprovado = [updatedItem, ...novoAprovado];
            } else {
                finalDivergente = [updatedItem, ...novoDivergente];
            }

            return {
                ...oldData,
                fila_ia: novaFilaIa,
                aprovado: finalAprovado,
                divergente: finalDivergente,
                sem_anexo: oldData.sem_anexo
            };
        });
    };

    return { 
        data, 
        isLoading, 
        error,
        updateLocalKanban 
    };
}