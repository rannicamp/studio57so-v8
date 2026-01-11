// hooks/financeiro/useLancamentos.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros'; 

export function useLancamentos({ 
    filters, 
    page = 1, 
    itemsPerPage = 50, 
    sortConfig = { key: 'data_vencimento', direction: 'descending' } 
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Passa pelo Porteiro antes de qualquer coisa
    const filtrosPadronizados = formatarFiltrosParaBanco(filters);

    return useQuery({
        // A chave do cache usa o filtro padronizado -> Cache muito mais eficiente!
        queryKey: ['lancamentos', filtrosPadronizados, page, itemsPerPage, sortConfig, organizacaoId],
        
        queryFn: async () => {
            if (!organizacaoId) return { data: [], count: 0, stats: {} };

            // 2. Chama a função turbinada no banco
            const { data: rpcResponse, error } = await supabase.rpc('get_lancamentos_avancado', {
                p_organizacao_id: organizacaoId,
                p_filtros: filtrosPadronizados, // <--- Enviando dados limpinhos
                p_page: page,
                p_items_per_page: itemsPerPage,
                p_sort_field: sortConfig.key || 'data_vencimento',
                p_sort_direction: sortConfig.direction === 'ascending' ? 'asc' : 'desc'
            });

            if (error) {
                console.error("Erro RPC lancamentos:", error);
                throw new Error("Erro ao carregar dados financeiros.");
            }

            // 3. Processamento dos Dados
            let lancamentos = rpcResponse?.data || [];
            
            // Pega o stats que agora VEM do banco (A mágica acontecendo)
            // Se vier null (banco velho), usa fallback zerado
            const stats = rpcResponse?.stats || { 
                totalReceitas: 0, totalDespesas: 0, resultado: 0, totalPendente: 0, totalPago: 0 
            };

            // 4. Enxerto Rico de Anexos (Mantemos pois é visual)
            const lancamentoIds = lancamentos.map(l => l.id);
            if (lancamentoIds.length > 0) {
                const { data: anexos } = await supabase
                    .from('lancamentos_anexos')
                    .select('*')
                    .in('lancamento_id', lancamentoIds);

                if (anexos) {
                    lancamentos = lancamentos.map(l => ({
                        ...l,
                        anexos: anexos.filter(a => a.lancamento_id === l.id)
                    }));
                }
            }

            return { 
                data: lancamentos, 
                count: rpcResponse?.count || 0,
                stats: stats // Entregamos o ouro para a tela
            };
        },
        staleTime: 60000, // 1 minuto de cache fresco
        placeholderData: (prev) => prev
    });
}