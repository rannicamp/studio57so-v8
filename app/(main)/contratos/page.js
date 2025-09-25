// app/(main)/contratos/page.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileInvoiceDollar, faStore, faArrowUpRightDots, faCalendarCheck, faChartPie } from '@fortawesome/free-solid-svg-icons';
import ContratoList from '../../../components/contratos/ContratoList';
import KpiCard from '../../../components/KpiCard';
import FiltroContratos from '../../../components/contratos/FiltroContratos';
import { useDebounce } from 'use-debounce';
import { createNewContrato } from './actions';
// ================================================================================= //
// O PORQUÊ DA ALTERAÇÃO:                                                            //
// Importamos funções da biblioteca `date-fns` para nos ajudar a formatar a data     //
// da última venda de forma relativa (ex: "Hoje", "Ontem", "Há 5 dias").              //
// O `ptBR` garante que o texto seja exibido em português.                            //
// ================================================================================= //
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fetchFilterData = async (organizacaoId) => {
    if (!organizacaoId) return { clientes: [], corretores: [], produtos: [], empreendimentos: [] };
    const supabase = createClient();
    const [clientesRes, corretoresRes, produtosRes, empreendimentosRes] = await Promise.all([
        supabase.rpc('get_clientes_com_contrato', { p_organizacao_id: organizacaoId }),
        supabase.rpc('get_corretores_com_contrato', { p_organizacao_id: organizacaoId }),
        supabase.from('produtos_empreendimento').select('id, tipo, unidade').eq('organizacao_id', organizacaoId),
        supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacaoId),
    ]);
    return {
        clientes: clientesRes.data || [],
        corretores: corretoresRes.data || [],
        produtos: produtosRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
    };
};

const fetchContratos = async (organizacaoId, filters, sortConfig) => {
    if (!organizacaoId) return [];
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('consultar_contratos_filtrados', {
        p_organizacao_id: organizacaoId,
        p_search_term: filters.searchTerm || null,
        p_cliente_ids: filters.clienteId?.length > 0 ? filters.clienteId : null,
        p_corretor_ids: filters.corretorId?.length > 0 ? filters.corretorId : null,
        p_produto_ids: filters.produtoId?.length > 0 ? filters.produtoId : null,
        p_empreendimento_ids: filters.empreendimentoId?.length > 0 ? filters.empreendimentoId : null,
        p_status: filters.status?.length > 0 ? filters.status : null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null
    })
    .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });

    if (error) {
        console.error("Erro ao buscar contratos via RPC: ", error);
        throw new Error(error.message);
    }
    return data;
};


export default function ContratosPage() {
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [filters, setFilters] = useState({
        searchTerm: '', clienteId: [], corretorId: [], produtoId: [], empreendimentoId: [],
        status: [], startDate: '', endDate: ''
    });
    const [sortConfig, setSortConfig] = useState({ key: 'data_venda', direction: 'descending' });
    const [debouncedFilters] = useDebounce(filters, 500);

    const { data: filterData, isLoading: isLoadingFilterData } = useQuery({
        queryKey: ['contratosFilterData', organizacaoId],
        queryFn: () => fetchFilterData(organizacaoId),
        enabled: !!organizacaoId,
    });

    const { data: contratos, isLoading: isLoadingContratos } = useQuery({
        queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig],
        queryFn: () => fetchContratos(organizacaoId, debouncedFilters, sortConfig),
        enabled: !!organizacaoId,
    });

    const kpiData = useMemo(() => {
        if (!contratos || contratos.length === 0) {
            return { totalVendido: 0, unidadesVendidas: 0, ticketMedio: 0, ultimaVenda: null, mediaVendasPorMes: 0 };
        }

        const datasVenda = contratos.map(c => new Date(c.data_venda));
        const primeiraVenda = new Date(Math.min.apply(null, datasVenda));
        const ultimaVenda = new Date(Math.max.apply(null, datasVenda));
        
        const mesesDeVendas = (ultimaVenda.getFullYear() - primeiraVenda.getFullYear()) * 12 + (ultimaVenda.getMonth() - primeiraVenda.getMonth()) + 1;
        
        const unidadesVendidas = contratos.length;
        const mediaVendasPorMes = mesesDeVendas > 0 ? unidadesVendidas / mesesDeVendas : 0;

        const totalVendido = contratos.reduce((acc, c) => acc + (c.valor_final_venda || 0), 0);
        const ticketMedio = unidadesVendidas > 0 ? totalVendido / unidadesVendidas : 0;
        
        return { 
            totalVendido, 
            unidadesVendidas, 
            ticketMedio, 
            ultimaVenda,
            mediaVendasPorMes
        };
    }, [contratos]);

    const isLoading = isLoadingFilterData || isLoadingContratos;
    
    // Função para formatar a data da última venda
    const formatUltimaVenda = (date) => {
        if (!date) return 'N/A';
        if (isToday(date)) return 'Hoje';
        if (isYesterday(date)) return 'Ontem';
        
        // A função retorna algo como "5 dias", "1 mês", etc.
        const distance = formatDistanceToNow(date, { locale: ptBR });
        return `Há ${distance}`;
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    if (isLoading) {
        return <div className="p-6 text-center"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <header className="mb-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-900">Gestão de Contratos</h1>
                    <form action={createNewContrato}>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700">
                            + Novo Contrato
                        </button>
                    </form>
                </div>
            </header>
            
            <main className="space-y-6">
                <FiltroContratos
                    filters={filters}
                    setFilters={setFilters}
                    clientes={filterData?.clientes || []}
                    corretores={filterData?.corretores || []}
                    produtos={filterData?.produtos || []}
                    empreendimentos={filterData?.empreendimentos || []}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <KpiCard title="Total Vendido (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalVendido)} icon={faFileInvoiceDollar} />
                    <KpiCard title="Unidades Vendidas (Filtro)" value={kpiData.unidadesVendidas} icon={faStore} />
                    <KpiCard title="Ticket Médio (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.ticketMedio)} icon={faArrowUpRightDots} />
                    <KpiCard title="Média de Vendas/Mês" value={kpiData.mediaVendasPorMes.toFixed(2).replace('.', ',')} icon={faChartPie} tooltip="Média de unidades vendidas por mês, com base no período filtrado." />
                    {/* ALTERADO: O valor agora usa a nova função de formatação */}
                    <KpiCard title="Última Venda (Filtro)" value={formatUltimaVenda(kpiData.ultimaVenda)} icon={faCalendarCheck} />
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <ContratoList 
                        contratos={contratos || []}
                        sortConfig={sortConfig}
                        requestSort={requestSort}
                        onUpdate={() => {
                            queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig] });
                        }}
                    />
                </div>
            </main>
        </div>
    );
}