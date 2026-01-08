import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useLancamentos({ 
    filters, 
    page = 1, 
    itemsPerPage = 50,
    sortConfig = { key: 'data_vencimento', direction: 'descending' } 
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    return useQuery({
        queryKey: ['lancamentos', filters, page, itemsPerPage, sortConfig, organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return { data: [], count: 0, stats: {} };

            const { data, error } = await supabase.rpc('get_lancamentos_avancado', {
                p_organizacao_id: organizacaoId,
                p_filtros: filters,
                p_page: page,
                p_items_per_page: itemsPerPage,
                p_sort_field: sortConfig.key || 'data_vencimento',
                p_sort_direction: sortConfig.direction === 'ascending' ? 'asc' : 'desc'
            });

            if (error) {
                console.error("Erro RPC lancamentos:", error);
                throw new Error("Erro ao carregar dados financeiros.");
            }

            // Agora retornamos stats também!
            return { 
                data: data?.data || [], 
                count: data?.count || 0,
                stats: data?.stats || { 
                    totalReceitas: 0, totalDespesas: 0, resultado: 0, totalPendente: 0, totalPago: 0 
                }
            };
        },
        placeholderData: (previousData) => previousData,
        staleTime: 60000, 
    });
}