// hooks/financeiro/useLancamentos.js
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

            // 1. Busca os lançamentos usando a função avançada (RPC)
            const { data: rpcResponse, error } = await supabase.rpc('get_lancamentos_avancado', {
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

            let lancamentos = rpcResponse?.data || [];
            
            // 2. CORREÇÃO "ENXERTO RICO": Buscar anexos detalhados separadamente
            // Se houver lançamentos, buscamos os anexos completos para garantir que temos o 'nome_arquivo'
            const lancamentoIds = lancamentos.map(l => l.id);
            
            if (lancamentoIds.length > 0) {
                const { data: anexosDetalhados, error: anexosError } = await supabase
                    .from('lancamentos_anexos')
                    .select('*') // Traz tudo: id, nome_arquivo, caminho_arquivo, etc.
                    .in('lancamento_id', lancamentoIds);

                if (!anexosError && anexosDetalhados) {
                    // 3. Hidrata os lançamentos com os anexos ricos
                    lancamentos = lancamentos.map(lancamento => {
                        const meusAnexos = anexosDetalhados.filter(a => a.lancamento_id === lancamento.id);
                        return {
                            ...lancamento,
                            anexos: meusAnexos // Substitui a lista pobre pela lista rica!
                        };
                    });
                }
            }

            // Agora retornamos os dados turbinados + stats
            return { 
                data: lancamentos, 
                count: rpcResponse?.count || 0,
                stats: rpcResponse?.stats || { 
                    totalReceitas: 0, totalDespesas: 0, resultado: 0, totalPendente: 0, totalPago: 0 
                }
            };
        },
        placeholderData: (previousData) => previousData,
        staleTime: 60000, 
    });
}