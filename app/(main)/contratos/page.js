// app/(main)/contratos/page.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFileInvoiceDollar, faArrowUpRightDots,
    faCalendarCheck, faChartPie, faHandshake, faChartLine,
    faPlus, faTimes, faSearch, faFilter
} from '@fortawesome/free-solid-svg-icons';
import ContratoList from '@/components/contratos/ContratoList';
import KpiCard from '@/components/KpiCard';
import FiltroContratos from '@/components/contratos/FiltroContratos';
import { useDebounce } from 'use-debounce';
import { createNewContrato } from './actions';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// --- PERSISTÊNCIA ---
const CONTRATOS_UI_STATE_KEY = 'STUDIO57_CONTRATOS_UI_STATE_V1';

const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(CONTRATOS_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

const fetchFilterData = async (organizacaoId) => {
    if (!organizacaoId) {
        return { clientes: [], corretores: [], produtos: [], empreendimentos: [] };
    }
    const supabase = await createClient();

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
    if (!dateString) return 'Nenhuma venda no período';
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

const fetchVgvPossivel = async (organizacaoId) => {
    if (!organizacaoId) return 0;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('calcular_vgv_possivel', { p_organizacao_id: organizacaoId });
    if (error) {
        console.error("Erro ao calcular VGV Possível:", error);
        return 0;
    }
    return data;
};

export default function ContratosPage() {
    const supabase = await createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const router = useRouter();

    // --- ESTADOS COM PERSISTÊNCIA ---
    const cachedState = getCachedUiState();
    
    // Filtros Padrão
    const defaultFilters = {
        searchTerm: '', clienteId: [], corretorId: [], produtoId: [], empreendimentoId: [],
        status: [], startDate: '', endDate: ''
    };

    const [filters, setFilters] = useState(cachedState?.filters || defaultFilters);
    const [sortConfig, setSortConfig] = useState(cachedState?.sortConfig || { key: 'numero_contrato', direction: 'descending' });
    const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);

    const [debouncedFilters] = useDebounce(filters, 500);

    // Salvar estado ao alterar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stateToSave = { filters, sortConfig, showFilters };
            localStorage.setItem(CONTRATOS_UI_STATE_KEY, JSON.stringify(stateToSave));
        }
    }, [filters, sortConfig, showFilters]);

    // Outros Estados (Modais)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [selectedTipoDocumento, setSelectedTipoDocumento] = useState('CONTRATO');
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
                toast.error("Erro ao buscar empreendimentos.");
                return [];
            }
            return data;
        },
        enabled: !!organizacaoId,
    });

    const { data: contratos, isLoading, error } = useQuery({
        queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig],
        queryFn: async () => {
             if (!organizacaoId) return [];
            let query = supabase
                .from('contratos')
                .select(`
                    id, data_venda, status_contrato, valor_final_venda, numero_contrato, tipo_documento,
                    contato:contato_id (id, nome, razao_social, cpf, cnpj),
                    empreendimento:empreendimento_id (id, nome),
                    produto:contrato_produtos (
                        produtos_empreendimento (unidade)
                    )
                `)
                .eq('organizacao_id', organizacaoId);

            if (debouncedFilters.searchTerm) {
                const isNumeric = /^\d+$/.test(debouncedFilters.searchTerm);
                if (isNumeric) {
                     query = query.eq('numero_contrato', debouncedFilters.searchTerm);
                } else {
                     query = query.or(`contato.nome.ilike.%${debouncedFilters.searchTerm}%,contato.razao_social.ilike.%${debouncedFilters.searchTerm}%`, { foreignTable: 'contato' });
                }
            }
            if (debouncedFilters.empreendimentoId.length > 0) query = query.in('empreendimento_id', debouncedFilters.empreendimentoId);
            if (debouncedFilters.clienteId.length > 0) query = query.in('contato_id', debouncedFilters.clienteId);
            if (debouncedFilters.corretorId.length > 0) query = query.in('corretor_id', debouncedFilters.corretorId);
            if (debouncedFilters.status.length > 0) query = query.in('status_contrato', debouncedFilters.status);
            if (debouncedFilters.startDate) query = query.gte('data_venda', debouncedFilters.startDate);
            if (debouncedFilters.endDate) query = query.lte('data_venda', debouncedFilters.endDate);
            
            if (sortConfig.key) {
                // Ajuste para ordenar colunas relacionadas se necessário, ou usar campos planos
                if (sortConfig.key === 'contato_nome') {
                     // Ordenação por relação complexa é difícil direto no supabase simples,
                     // geralmente ordena-se no cliente ou usa uma RPC.
                     // Fallback para numero_contrato se for complexo, ou manter como está se a view permitir.
                     // Por segurança, ordenamos por created_at se for complexo, ou implementamos sort no cliente.
                     // Mantendo padrão do supabase:
                     query = query.order('created_at', { ascending: false });
                } else {
                     query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
                }
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            // Ajuste dos dados para a tabela (flattening produtos)
            return data.map(c => ({
                ...c,
                produto: c.produto?.[0]?.produtos_empreendimento || null
            }));
        },
        enabled: !!organizacaoId
    });

    const kpiData = useMemo(() => {
        if (!contratos) return { totalVendido: 0, contratosAssinados: 0, ticketMedio: 0, mediaVendasPorMes: 0, ultimaVenda: null };
        const dataParaKpis = contratos.filter(c => c.status_contrato === 'Assinado');
        if (dataParaKpis.length === 0) return { totalVendido: 0, contratosAssinados: 0, ticketMedio: 0, mediaVendasPorMes: 0, ultimaVenda: null };
        
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

    const handleCreateContrato = async () => {
        if (!selectedEmpreendimentoId || !selectedTipoDocumento) {
            toast.error("Selecione o tipo de documento e o empreendimento.");
            return;
        }
        setIsCreating(true); 
        try {
            const result = await createNewContrato(selectedEmpreendimentoId, selectedTipoDocumento); 
            if (result?.success && result?.newContractId) {
                toast.success("Documento criado! Redirecionando...");
                setIsModalOpen(false);
                setSelectedEmpreendimentoId('');
                setSelectedTipoDocumento('CONTRATO');
                router.push(`/contratos/${result.newContractId}`);
                queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId] });
            } else if (result?.error) {
                toast.error(`Erro ao criar documento: ${result.error}`);
            } else {
                toast.error("Ocorreu um erro inesperado ao criar o documento.");
            }
        } catch (err) {
            console.error("Erro action:", err);
            toast.error(`Erro: ${err.message || "Falha de comunicação."}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleCloseModal = () => { setIsModalOpen(false); setSelectedEmpreendimentoId(''); setSelectedTipoDocumento('CONTRATO'); };

    if (isLoading && !contratos) return <div className="flex justify-center items-center h-screen"><FontAwesomeIcon icon={faSpinner} spin size="3x" /></div>;
    if (error) return <div className="text-center py-10 text-red-500">Erro ao carregar contratos: {error.message}</div>;

    return (
        <div className="space-y-6">
            
            {/* CABEÇALHO UNIFICADO */}
            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6 rounded-lg">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-800 uppercase">Gestão de Contratos</h1>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-2">
                            {contratos?.length || 0} Docs
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                        {/* Busca Global */}
                        <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar por nº, cliente ou CPF..." 
                                value={filters.searchTerm} 
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Botão Filtros */}
                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                            title="Filtros Avançados"
                        >
                            <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} />
                            Filtros
                        </button>

                        <div className="h-8 w-px bg-gray-300 mx-1 hidden md:block"></div>

                        {/* Botão Novo */}
                        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200">
                            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo Documento
                        </button>
                    </div>
                </div>

                {/* PAINEL DE FILTROS */}
                {showFilters && (
                    <FiltroContratos
                        filters={filters}
                        setFilters={setFilters}
                        clientes={filterData?.clientes || []}
                        corretores={filterData?.corretores || []} 
                        produtos={filterData?.produtos || []}
                        empreendimentos={filterData?.empreendimentos || []}
                    />
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <KpiCard
                        title="VGV Possível"
                        value={isLoadingVgv ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvPossivel || 0)}
                        icon={faChartLine}
                        tooltip="Soma dos contratos assinados e unidades disponíveis para empreendimentos listados."
                    />
                    <KpiCard title="Total Vendido" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalVendido)} icon={faFileInvoiceDollar} />
                    <KpiCard title="Assinados" value={kpiData.contratosAssinados} icon={faHandshake} />
                    <KpiCard title="Ticket Médio" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.ticketMedio)} icon={faArrowUpRightDots} />
                    <KpiCard title="Vendas/Mês" value={kpiData.mediaVendasPorMes.toFixed(2).replace('.', ',')} icon={faChartPie} />
                    <KpiCard title="Última Venda" value={formatUltimaVenda(kpiData.ultimaVenda)} icon={faCalendarCheck} />
                </div>
            </div>

            {/* TABELA */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <ContratoList
                    contratos={contratos || []}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                    onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ['contratos', organizacaoId, debouncedFilters, sortConfig] });
                        queryClient.invalidateQueries({ queryKey: ['vgvPossivel', organizacaoId] });
                    }}
                    organizacaoId={organizacaoId} 
                />
            </div>

            {/* MODAL NOVO CONTRATO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fadeIn">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-xl font-bold text-gray-800">Criar Novo Documento</h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-1">
                                <FontAwesomeIcon icon={faTimes} size="lg"/>
                            </button>
                        </div>
                        
                        <div>
                            <label htmlFor="tipoDocumento" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                            <select
                                id="tipoDocumento"
                                value={selectedTipoDocumento}
                                onChange={(e) => setSelectedTipoDocumento(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="CONTRATO">Contrato Completo</option>
                                <option value="TERMO_DE_INTERESSE">Termo de Interesse</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="empreendimento" className="block text-sm font-medium text-gray-700 mb-1">Empreendimento</label>
                            {isLoadingEmpreendimentosModal ? (
                                <div className="text-center py-4 text-sm text-gray-500">
                                    <FontAwesomeIcon icon={faSpinner} spin /> Carregando...
                                </div>
                            ) : empreendimentosParaVenda.length === 0 ? (
                                <p className="text-center text-red-500 py-4 text-sm">Nenhum empreendimento listado para venda.</p>
                            ) : (
                                <select
                                    id="empreendimento"
                                    value={selectedEmpreendimentoId}
                                    onChange={(e) => setSelectedEmpreendimentoId(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">-- Selecione o Empreendimento --</option>
                                    {empreendimentosParaVenda.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 font-medium">Cancelar</button>
                            <button
                                type="button"
                                onClick={handleCreateContrato}
                                disabled={!selectedEmpreendimentoId || !selectedTipoDocumento || isLoadingEmpreendimentosModal || isCreating}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center min-w-[140px] font-medium shadow-sm transition-colors"
                            >
                                {isCreating ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Criando...</> : 'Criar e Continuar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}