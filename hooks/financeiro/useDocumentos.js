import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDocumentos({ 
    filters, 
    page = 1, 
    itemsPerPage = 50 
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    return useQuery({
        queryKey: ['documentosFinanceiros', filters, page, itemsPerPage, organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return { data: [], count: 0 };

            // Inicia a query na tabela de ANEXOS
            // O !inner no lancamento obriga que o anexo tenha um lançamento que obedeça aos filtros
            let query = supabase
                .from('lancamentos_anexos')
                .select(`
                    *,
                    lancamento:lancamentos!inner (
                        id, descricao, valor, data_vencimento, tipo, status,
                        conta:contas_financeiras(nome),
                        favorecido:contatos(nome, razao_social)
                    ),
                    tipo_documento:documento_tipos(sigla, descricao)
                `, { count: 'exact' });

            query = query.eq('organizacao_id', organizacaoId);

            // --- APLICAÇÃO DOS FILTROS (Referenciando a tabela relacionada 'lancamentos') ---

            if (filters.contaIds?.length > 0) {
                query = query.in('lancamento.conta_id', filters.contaIds);
            }

            if (filters.categoriaIds?.length > 0) {
                query = query.in('lancamento.categoria_id', filters.categoriaIds);
            }

            if (filters.empresaIds?.length > 0) {
                query = query.in('lancamento.empresa_id', filters.empresaIds);
            }

            if (filters.status?.length > 0) {
                 // Simplificação para status (Pendente/Pago)
                 const statusList = [];
                 if (filters.status.includes('Pago')) statusList.push('Pago', 'Conciliado');
                 if (filters.status.includes('Pendente') || filters.status.includes('Atrasada')) statusList.push('Pendente');
                 
                 if(statusList.length > 0) {
                    query = query.in('lancamento.status', statusList);
                 }
            }

            if (filters.tipo?.length > 0) {
                query = query.in('lancamento.tipo', filters.tipo);
            }

            // Filtro de Data (Vencimento do lançamento)
            if (filters.startDate) {
                query = query.gte('lancamento.data_vencimento', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('lancamento.data_vencimento', filters.endDate);
            }

            if (filters.favorecidoId) {
                query = query.eq('lancamento.favorecido_contato_id', filters.favorecidoId);
            }

            if (filters.searchTerm) {
                // Busca tanto no nome do arquivo quanto na descrição do lançamento
                query = query.or(`nome_arquivo.ilike.%${filters.searchTerm}%,lancamento.descricao.ilike.%${filters.searchTerm}%`);
            }

            // Ordenação (Mais recentes primeiro)
            query = query.order('created_at', { ascending: false });

            // Paginação
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) {
                console.error("Erro ao buscar documentos:", error);
                throw new Error("Não foi possível carregar os documentos.");
            }

            return { data, count };
        },
        placeholderData: (previousData) => previousData,
        staleTime: 5 * 60 * 1000, 
    });
}