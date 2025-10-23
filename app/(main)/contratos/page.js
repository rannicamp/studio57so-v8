// app/(main)/contratos/page.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFileInvoiceDollar, faArrowUpRightDots,
    faCalendarCheck, faChartPie, faHandshake, faChartLine,
    faPlus, faTimes
} from '@fortawesome/free-solid-svg-icons';
import ContratoList from '../../../components/contratos/ContratoList';
import KpiCard from '../../../components/KpiCard';
import FiltroContratos from '../../../components/contratos/FiltroContratos';
import { useDebounce } from 'use-debounce';
import { createNewContrato } from './actions';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner'; // <-- Importa o toast

// Funções fetchFilterData, formatUltimaVenda, fetchVgvPossivel (sem mudanças)
const fetchFilterData = async (organizacaoId) => {
    // ... (código inalterado) ...
    if (!organizacaoId) {
        return { clientes: [], corretores: [], produtos: [], empreendimentos: [] };
    }
    const supabase = createClient();

    const clientesPromise = supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacaoId);
    const corretoresPromise = supabase.from('contatos').select('id, nome, razao_social').eq('tipo_contato', 'Corretor').eq('organizacao_id', organizacaoId);
    const produtosPromise = supabase.from('produtos_empreendimento').select('id, unidade, tipo').eq('organizacao_id', organizacaoId);
    const empreendimentosPromise = supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacaoId);

    const [{ data: clientes }, { data: corretores }, { data: produtos }, { data: empreendimentos }] = await Promise.all([
        clientesPromise, corretoresPromise, produtosPromise, empreendimentosPromise
    ]);

    return { clientes, corretores, produtos, empreendimentos };
};

const formatUltimaVenda = (dateString) => {
    // ... (código inalterado) ...
    if (!dateString) return 'Nenhuma venda no período';
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

const fetchVgvPossivel = async (organizacaoId) => {
    // ... (código inalterado) ...
    if (!organizacaoId) return 0;
    const supabase = createClient();
    const { data, error } = await supabase.rpc('calcular_vgv_possivel', { p_organizacao_id: organizacaoId });
    if (error) {
        console.error("Erro ao calcular VGV Possível:", error);
        return 0;
    }
    return data;
};


export default function ContratosPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const router = useRouter();

    const [filters, setFilters] = useState({
        searchTerm: '', clienteId: [], corretorId: [], produtoId: [], empreendimentoId: [],
        status: [], startDate: '', endDate: ''
    });
    const [debouncedFilters] = useDebounce(filters, 500);
    const [sortConfig, setSortConfig] = useState({ key: 'numero_contrato', direction: 'descending' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const { data: filterData } = useQuery({
        queryKey: ['contratosFilterData', organizacaoId],
        queryFn: () => fetchFilterData(organizacaoId),
        enabled: !!organizacaoId
    });

    const { data: vgvPossivel, isLoading: isLoadingVgv } = useQuery({
        queryKey: ['vgvPossivel', organizacaoId],
        queryFn: () => fetchVgvPossivel(organizacaoId),
        enabled: !!organizacaoId,
    });

    const { data: empreendimentosParaVenda = [], isLoading: isLoadingEmpreendimentosModal } = useQuery({
        queryKey: ['empreendimentosParaVendaContrato', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return [];
            const { data, error } = await supabase
                .from('empreendimentos')
                .select('id, nome')
                .eq('organizacao_id', organizacaoId)
                .eq('listado_para_venda', true)
                .order('nome');
            if (error) {
                toast.error("Erro ao buscar empreendimentos para venda.");
                console.error(error);
                return [];
            }
            return data;
        },
        enabled: !!organizacaoId,
    });

    const { data: contratos, isLoading, error } = useQuery({
        queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig],
        queryFn: async () => {
            // ... (lógica da query inalterada) ...
             if (!organizacaoId) return [];
            let query = supabase
                .from('contratos')
                .select(`
                    id, data_venda, status_contrato, valor_final_venda, numero_contrato,
                    contato:contato_id (id, nome, razao_social),
                    empreendimento:empreendimento_id (id, nome),
                    contrato_produtos (
                        produtos_empreendimento (unidade)
                    )
                `)
                .eq('organizacao_id', organizacaoId);

            if (debouncedFilters.searchTerm) {
                query = query.or(`contato.nome.ilike.%${debouncedFilters.searchTerm}%,contato.razao_social.ilike.%${debouncedFilters.searchTerm}%`);
            }
            if (debouncedFilters.empreendimentoId.length > 0) query = query.in('empreendimento_id', debouncedFilters.empreendimentoId);
            if (debouncedFilters.clienteId.length > 0) query = query.in('contato_id', debouncedFilters.clienteId);
            if (debouncedFilters.corretorId.length > 0) query = query.in('corretor_id', debouncedFilters.corretorId);
            if (debouncedFilters.status.length > 0) query = query.in('status_contrato', debouncedFilters.status);
            if (debouncedFilters.startDate) query = query.gte('data_venda', debouncedFilters.startDate);
            if (debouncedFilters.endDate) query = query.lte('data_venda', debouncedFilters.endDate);
            if (sortConfig.key) {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!organizacaoId
    });

    const kpiData = useMemo(() => {
        // ... (lógica inalterada) ...
        if (!contratos) {
            return { totalVendido: 0, contratosAssinados: 0, ticketMedio: 0, mediaVendasPorMes: 0, ultimaVenda: null };
        }
        const dataParaKpis = contratos.filter(c => c.status_contrato === 'Assinado');
        if (dataParaKpis.length === 0) {
            return { totalVendido: 0, contratosAssinados: 0, ticketMedio: 0, mediaVendasPorMes: 0, ultimaVenda: null };
        }
        const totalVendido = dataParaKpis.reduce((acc, contrato) => acc + (parseFloat(contrato.valor_final_venda) || 0), 0);
        const contratosAssinados = dataParaKpis.length;
        const ticketMedio = contratosAssinados > 0 ? totalVendido / contratosAssinados : 0;
        const datasVenda = dataParaKpis.map(c => new Date(c.data_venda));
        const dataMin = new Date(Math.min.apply(null, datasVenda));
        const dataMax = new Date(Math.max.apply(null, datasVenda));
        const diffAnos = dataMax.getFullYear() - dataMin.getFullYear();
        const diffMeses = dataMax.getMonth() - dataMin.getMonth();
        const totalMesesNoPeriodo = (diffAnos * 12) + diffMeses + 1;
        const mediaVendasPorMes = totalMesesNoPeriodo > 0 ? contratosAssinados / totalMesesNoPeriodo : 0;
        const ultimaVenda = dataParaKpis.reduce((latest, current) => new Date(current.data_venda) > new Date(latest.data_venda) ? current : latest).data_venda;

        return { totalVendido, contratosAssinados, ticketMedio, mediaVendasPorMes, ultimaVenda };
    }, [contratos]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><FontAwesomeIcon icon={faSpinner} spin size="3x" /></div>;
    }
    if (error) {
        return <div className="text-center py-10 text-red-500">Erro ao carregar contratos: {error.message}</div>;
    }

    // --- FUNÇÃO handleCreateContrato REFINADA ---
    const handleCreateContrato = async () => {
        if (!selectedEmpreendimentoId) {
            toast.error("Selecione um empreendimento.");
            return;
        }

        setIsCreating(true); // Ativa o loading

        try {
            // Chama a Server Action
            const result = await createNewContrato(selectedEmpreendimentoId);

            // Verifica explicitamente a resposta
            if (result?.success && result?.newContractId) {
                toast.success("Contrato criado! Redirecionando...");
                // Primeiro fecha o modal e limpa o estado
                setIsModalOpen(false);
                setSelectedEmpreendimentoId('');
                // DEPOIS redireciona
                router.push(`/contratos/${result.newContractId}`);
                // Invalida a query da lista para atualizar em segundo plano
                queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId] });
            } else if (result?.error) {
                // Se a action retornou um erro conhecido
                toast.error(`Erro ao criar contrato: ${result.error}`);
            } else {
                // Se a action retornou algo inesperado
                console.error("Resposta inesperada da action:", result);
                toast.error("Ocorreu um erro inesperado ao criar o contrato.");
            }
        } catch (err) {
            // Captura erros de rede ou exceções não tratadas na action
            console.error("Erro ao chamar createNewContrato:", err);
            toast.error(`Erro: ${err.message || "Falha na comunicação com o servidor."}`);
        } finally {
            // Garante que o loading sempre seja desativado
            setIsCreating(false);
        }
    };
    // --- FIM DA FUNÇÃO REFINADA ---

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Gestão de Contratos</h1>
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} /> Novo Contrato
                </button>
            </div>

            <FiltroContratos
                filters={filters}
                setFilters={setFilters}
                clientes={filterData?.clientes || []}
                corretores={filterData?.corretores || []}
                produtos={filterData?.produtos || []}
                empreendimentos={filterData?.empreendimentos || []}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard
                    title="VGV Possível"
                    value={isLoadingVgv ? 'Calculando...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvPossivel || 0)}
                    icon={faChartLine}
                    tooltip="Soma dos contratos assinados e unidades disponíveis para empreendimentos listados."
                />
                <KpiCard title="Total Vendido (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalVendido)} icon={faFileInvoiceDollar} />
                <KpiCard title="Contratos Assinados" value={kpiData.contratosAssinados} icon={faHandshake} />
                <KpiCard title="Ticket Médio (Filtro)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.ticketMedio)} icon={faArrowUpRightDots} />
                <KpiCard title="Média de Vendas/Mês" value={kpiData.mediaVendasPorMes.toFixed(2).replace('.', ',')} icon={faChartPie} tooltip="Média de contratos assinados por mês, com base no período filtrado." />
                <KpiCard title="Última Venda (Filtro)" value={formatUltimaVenda(kpiData.ultimaVenda)} icon={faCalendarCheck} />
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <ContratoList
                    contratos={contratos || []}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                    onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig] });
                        queryClient.invalidateQueries({ queryKey: ['vgvPossivel', organizacaoId] });
                    }}
                />
            </div>

            {/* --- MODAL DE SELEÇÃO DE EMPREENDIMENTO --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Criar Novo Contrato</h3>
                             <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                 <FontAwesomeIcon icon={faTimes} size="lg"/>
                             </button>
                        </div>
                        <p className="text-gray-600 mb-4">Selecione o empreendimento para iniciar:</p>

                        {isLoadingEmpreendimentosModal ? (
                            <div className="text-center py-4">
                                <FontAwesomeIcon icon={faSpinner} spin /> Carregando empreendimentos...
                            </div>
                        ) : empreendimentosParaVenda.length === 0 ? (
                             <p className="text-center text-red-500 py-4">Nenhum empreendimento listado para venda encontrado.</p>
                        ) : (
                            <select
                                value={selectedEmpreendimentoId}
                                onChange={(e) => setSelectedEmpreendimentoId(e.target.value)}
                                className="w-full p-2 border rounded-md mb-6"
                            >
                                <option value="">-- Selecione o Empreendimento --</option>
                                {empreendimentosParaVenda.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setIsModalOpen(false); setSelectedEmpreendimentoId(''); }}
                                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateContrato}
                                disabled={!selectedEmpreendimentoId || isLoadingEmpreendimentosModal || isCreating}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center min-w-[150px]"
                            >
                                {isCreating ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Criar e Continuar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
             {/* --- FIM DO MODAL --- */}

        </div>
    );
}