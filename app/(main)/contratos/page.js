// app/(main)/contratos/page.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileInvoiceDollar, faStore, faArrowUpRightDots, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';
import ContratoList from '../../../components/contratos/ContratoList';
import KpiCard from '../../../components/KpiCard';
import FiltroContratos from '../../../components/contratos/FiltroContratos';
import { useDebounce } from 'use-debounce';

const fetchFilterData = async (organizacaoId) => {
    if (!organizacaoId) return { clientes: [], corretores: [], produtos: [], empreendimentos: [] };
    const supabase = createClient();
    
    // O PORQUÊ: Agora chamamos a nova função que busca apenas clientes com contratos.
    const [clientesRes, corretoresRes, produtosRes, empreendimentosRes] = await Promise.all([
        supabase.rpc('get_clientes_com_contrato', { p_organizacao_id: organizacaoId }),
        supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacaoId).eq('tipo_contato', 'Corretor'),
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
        if (!contratos) return { totalVendido: 0, unidadesVendidas: 0, ticketMedio: 0, ultimaVenda: null };
        const totalVendido = contratos.reduce((acc, c) => acc + (c.valor_final_venda || 0), 0);
        const unidadesVendidas = contratos.length;
        const ticketMedio = unidadesVendidas > 0 ? totalVendido / unidadesVendidas : 0;
        const ultimaVenda = contratos.length > 0 ? contratos.map(c => new Date(c.data_venda)).sort((a, b) => b - a)[0] : null;
        return { totalVendido, unidadesVendidas, ticketMedio, ultimaVenda };
    }, [contratos]);

    const isLoading = isLoadingFilterData || isLoadingContratos;
    
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
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-3xl font-bold text-gray-900">Gestão de Contratos</h1>
                 <Link href="/contratos/cadastro" className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700">
                    + Novo Contrato
                </Link>
            </div>
            
            <FiltroContratos
                filters={filters}
                setFilters={setFilters}
                clientes={filterData?.clientes || []}
                corretores={filterData?.corretores || []}
                produtos={filterData?.produtos || []}
                empreendimentos={filterData?.empreendimentos || []}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Vendido (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalVendido)} icon={faFileInvoiceDollar} />
                <KpiCard title="Unidades Vendidas (Filtro)" value={kpiData.unidadesVendidas} icon={faStore} />
                <KpiCard title="Ticket Médio (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.ticketMedio)} icon={faArrowUpRightDots} />
                <KpiCard title="Última Venda (Filtro)" value={kpiData.ultimaVenda ? kpiData.ultimaVenda.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A'} icon={faCalendarCheck} />
            </div>

            <ContratoList 
                contratos={contratos || []}
                sortConfig={sortConfig}
                requestSort={requestSort}
                onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig] });
                }}
            />
        </div>
    );
}