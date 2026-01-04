import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const NULL_ID = 'IS_NULL';

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
            if (!organizacaoId) return { data: [], count: 0 };

            let query = supabase
                .from('lancamentos')
                .select(`
                    *,
                    conta:contas_financeiras!conta_id (id, nome, tipo, empresa:cadastro_empresa(nome_fantasia, razao_social)),
                    categoria:categorias_financeiras!categoria_id (id, nome),
                    empreendimento:empreendimentos!empreendimento_id (id, nome),
                    favorecido:contatos!favorecido_contato_id (id, nome, razao_social),
                    anexos:lancamentos_anexos (id)
                `, { count: 'exact' });

            // 1. Filtro de Segurança
            query = query.eq('organizacao_id', organizacaoId);

            // FUNÇÃO AUXILIAR PARA LIDAR COM "SEM REGISTRO" (NULL)
            const applyFilterWithNullCheck = (coluna, valores) => {
                if (!valores || valores.length === 0) return;

                const hasNull = valores.includes(NULL_ID);
                const realIds = valores.filter(v => v !== NULL_ID);

                if (hasNull && realIds.length === 0) {
                    // Selecionou APENAS "Sem Registro"
                    query = query.is(coluna, null);
                } else if (hasNull && realIds.length > 0) {
                    // Selecionou "Sem Registro" E outros valores
                    // Supabase syntax para OR: "coluna.in.(1,2),coluna.is.null"
                    const orCondition = `${coluna}.in.(${realIds.join(',')}),${coluna}.is.null`;
                    query = query.or(orCondition);
                } else if (realIds.length > 0) {
                    // Apenas valores normais
                    query = query.in(coluna, realIds);
                }
            };

            // 2. Filtros de Multi-Seleção (Com suporte a NULL)
            applyFilterWithNullCheck('conta_id', filters.contaIds);
            applyFilterWithNullCheck('categoria_id', filters.categoriaIds);
            applyFilterWithNullCheck('empresa_id', filters.empresaIds);
            applyFilterWithNullCheck('empreendimento_id', filters.empreendimentoIds);
            applyFilterWithNullCheck('etapa_id', filters.etapaIds);

            // 3. Filtro de Status
            if (filters.status?.length > 0) {
                const statusParaBuscar = [];
                const buscaAtrasados = filters.status.includes('Atrasada');
                
                if (filters.status.includes('Pago')) statusParaBuscar.push('Pago', 'Conciliado');
                if (filters.status.includes('Pendente') || filters.status.includes('A Pagar')) statusParaBuscar.push('Pendente');
                
                if (statusParaBuscar.length > 0) {
                    query = query.in('status', statusParaBuscar);
                }

                if (buscaAtrasados && !filters.status.includes('Pendente')) {
                    query = query.eq('status', 'Pendente').lt('data_vencimento', new Date().toISOString().split('T')[0]);
                }
            }

            // 4. Filtro de Tipo
            if (filters.tipo?.length > 0) {
                query = query.in('tipo', filters.tipo);
            }

            // 5. Filtro de Data
            if (filters.startDate) {
                query = query.gte('data_vencimento', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('data_vencimento', filters.endDate);
            }

            // 6. Filtro de Favorecido (Com suporte a NULL)
            if (filters.favorecidoId) {
                if (filters.favorecidoId === NULL_ID) {
                    query = query.is('favorecido_contato_id', null);
                } else {
                    query = query.eq('favorecido_contato_id', filters.favorecidoId);
                }
            }

            // 7. Filtro de Busca Textual
            if (filters.searchTerm) {
                query = query.ilike('descricao', `%${filters.searchTerm}%`);
            }

            // 8. Ocultar Transferências
            if (filters.ignoreTransfers) {
                query = query.is('transferencia_id', null);
            }

            // 9. Ocultar Estornos (BLINDAGEM DUPLA)
            if (filters.ignoreChargebacks) {
                query = query.not('categoria_id', 'in', '(189,308)');
            }

            // 10. Ordenação
            if (sortConfig.key) {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
            } else {
                query = query.order('data_vencimento', { ascending: false });
            }

            // 11. Paginação
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) {
                console.error("Erro ao buscar lançamentos:", error);
                throw new Error("Erro ao carregar dados financeiros.");
            }

            return { data, count };
        },
        placeholderData: (previousData) => previousData,
        staleTime: 5 * 60 * 1000, 
    });
}