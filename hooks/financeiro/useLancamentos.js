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

            // 1. Filtro de Segurança (Sempre aplica)
            query = query.eq('organizacao_id', organizacaoId);

            // 2. Filtros de Multi-Seleção (Só aplica se tiver algo selecionado)
            if (filters.contaIds?.length > 0) {
                query = query.in('conta_id', filters.contaIds);
            }

            if (filters.categoriaIds?.length > 0) {
                query = query.in('categoria_id', filters.categoriaIds);
            }

            if (filters.empresaIds?.length > 0) {
                query = query.in('empresa_id', filters.empresaIds);
            }

            if (filters.empreendimentoIds?.length > 0) {
                query = query.in('empreendimento_id', filters.empreendimentoIds);
            }

            if (filters.etapaIds?.length > 0) {
                query = query.in('etapa_id', filters.etapaIds);
            }

            // 3. Filtro de Status
            if (filters.status?.length > 0) {
                // Mapeia 'Atrasada' e 'A Pagar' para o status real do banco se necessário,
                // mas como seu banco usa 'Pendente' e 'Pago', vamos ajustar:
                
                const statusParaBuscar = [];
                const buscaAtrasados = filters.status.includes('Atrasada');
                
                if (filters.status.includes('Pago')) statusParaBuscar.push('Pago', 'Conciliado');
                if (filters.status.includes('Pendente') || filters.status.includes('A Pagar')) statusParaBuscar.push('Pendente');
                
                if (statusParaBuscar.length > 0) {
                    query = query.in('status', statusParaBuscar);
                }

                // Lógica especial para 'Atrasada' (Pendente + Vencimento < Hoje)
                if (buscaAtrasados && !filters.status.includes('Pendente')) {
                    // Se só selecionou atrasada, força pendente e data antiga
                    query = query.eq('status', 'Pendente').lt('data_vencimento', new Date().toISOString().split('T')[0]);
                }
            }

            // 4. Filtro de Tipo (Receita/Despesa)
            if (filters.tipo?.length > 0) {
                query = query.in('tipo', filters.tipo);
            }

            // 5. Filtro de Data (Prioridade: Vencimento para filtrar listas gerais)
            if (filters.startDate) {
                query = query.gte('data_vencimento', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('data_vencimento', filters.endDate);
            }

            // 6. Filtro de Favorecido
            if (filters.favorecidoId) {
                query = query.eq('favorecido_contato_id', filters.favorecidoId);
            }

            // 7. Filtro de Busca Textual (Descrição)
            if (filters.searchTerm) {
                query = query.ilike('descricao', `%${filters.searchTerm}%`);
            }

            // 8. Ocultar Transferências (Lógica Nova)
            if (filters.ignoreTransfers) {
                query = query.is('transferencia_id', null);
            }

            // 9. Ordenação
            if (sortConfig.key) {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
            } else {
                query = query.order('data_vencimento', { ascending: false });
            }

            // 10. Paginação (Calculada no Servidor)
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
        placeholderData: (previousData) => previousData, // Mantém os dados antigos enquanto carrega os novos (UX melhor)
        staleTime: 5 * 60 * 1000, // Cache de 5 minutos
    });
}