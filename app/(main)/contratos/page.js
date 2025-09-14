// app/(main)/contratos/page.js
"use client";

import { useMemo, useEffect } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import { useLayout } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext'; // 1. Importar para pegar a organização
import { useQuery, useQueryClient } from '@tanstack/react-query'; // 2. Importar useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileInvoiceDollar, faStore, faArrowUpRightDots, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';
import ContratoList from '../../../components/contratos/ContratoList';
import KpiCard from '../../../components/KpiCard';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A busca foi isolada e agora exige o `organizacaoId` para filtrar os
// contratos, garantindo que cada usuário veja apenas os dados de sua empresa.
// =================================================================================
const fetchContratos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id ( nome, razao_social ),
            produto:produto_id ( unidade, tipo ),
            empreendimento:empreendimento_id ( nome ),
            corretor:corretor_id ( nome ) 
        `)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar contratos:", error);
        throw new Error(error.message);
    }
    return data || [];
};

export default function ContratosPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Pegamos o usuário
    const organizacaoId = user?.organizacao_id; // E sua organização

    useEffect(() => {
        setPageTitle("Gestão de Contratos");
    }, [setPageTitle]);

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia o estado de carregamento, erros e cache de
    // forma mais eficiente, simplificando o nosso código.
    // =================================================================================
    const { data: contratos = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ['contratos', organizacaoId],
        queryFn: () => fetchContratos(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });
    
    // Os KPIs agora são calculados com useMemo para performance, usando os dados seguros do useQuery.
    const kpiData = useMemo(() => {
        const totalVendido = contratos.reduce((acc, contrato) => acc + (contrato.valor_final_venda || 0), 0);
        const unidadesVendidas = contratos.length;
        const ticketMedio = unidadesVendidas > 0 ? totalVendido / unidadesVendidas : 0;
        const ultimaVenda = contratos.length > 0
            ? new Date(Math.max(...contratos.map(c => new Date(c.created_at))))
            : null;
        
        return { totalVendido, unidadesVendidas, ticketMedio, ultimaVenda };
    }, [contratos]);

    const handleActionComplete = () => {
        // Invalida a query para forçar a busca de dados atualizados
        queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId] });
    };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
    }
    
    if (isError) {
        return <p className="p-4 text-center text-red-500">Erro ao carregar contratos: {error.message}</p>
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard 
                    title="Valor Total (VGV)" 
                    value={`R$ ${kpiData.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    icon={faFileInvoiceDollar} 
                />
                <KpiCard 
                    title="Unidades Vendidas" 
                    value={kpiData.unidadesVendidas} 
                    icon={faStore} 
                />
                <KpiCard 
                    title="Ticket Médio" 
                    value={`R$ ${kpiData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    icon={faArrowUpRightDots} 
                />
                <KpiCard 
                    title="Última Venda" 
                    value={kpiData.ultimaVenda ? new Date(kpiData.ultimaVenda).toLocaleDateString('pt-BR') : 'N/A'} 
                    icon={faCalendarCheck} 
                />
            </div>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Todos os Contratos</h1>
                <Link href="/contratos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                    + Novo Contrato
                </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <ContratoList initialContratos={contratos} onActionComplete={handleActionComplete} />
            </div>
        </div>
    );
}