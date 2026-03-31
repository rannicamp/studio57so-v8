// app/(main)/contratos/page.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// 1. IMPORTAÇÃO DO CONTEXTO DE LAYOUT (Faltava isso!)
import { useLayout } from '@/contexts/LayoutContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFileInvoiceDollar, faArrowUpRightDots,
    faCalendarCheck, faChartPie, faHandshake, faChartLine,
    faPlus, faTimes, faSearch, faFilter, faFileSignature
} from '@fortawesome/free-solid-svg-icons';
import ContratoList from '@/components/contratos/ContratoList';
import KpiCard from '@/components/shared/KpiCard';
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
    if (!dateString) return 'Nenhuma venda no período';
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

const fetchVgvPossivel = async (organizacaoId) => {
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

    // 2. USO DO HOOK DE LAYOUT (Para mudar o título)
    const { setPageTitle } = useLayout();

    const organizacaoId = user?.organizacao_id;
    const router = useRouter();

    // 3. EFEITO PARA DEFINIR O TÍTULO (O crachá da página)
    useEffect(() => {
        setPageTitle('Gestão de Contratos');
    }, [setPageTitle]);

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

            // CORREÇÃO: Adicionado !inner para garantir que o filtro de busca funcione na tabela contratos
            let query = supabase
                .from('contratos')
                .select(`
                    id, data_venda, status_contrato, valor_final_venda, numero_contrato, tipo_documento, lixeira,
                    contato:contato_id!inner (id, nome, razao_social, cpf, cnpj), 
                    empreendimento:empreendimento_id (id, nome),
                    produto:contrato_produtos (
                        produtos_empreendimento (unidade)
                    )
                `)
                .eq('organizacao_id', organizacaoId)
                .eq('lixeira', false);

            if (debouncedFilters.searchTerm) {
                const isNumeric = /^\d+$/.test(debouncedFilters.searchTerm);
                if (isNumeric) {
                    query = query.eq('numero_contrato', debouncedFilters.searchTerm);
                } else {
                    // CORREÇÃO: Removido o prefixo 'contato.' de dentro da string do .or()
                    query = query.or(`nome.ilike.%${debouncedFilters.searchTerm}%,razao_social.ilike.%${debouncedFilters.searchTerm}%`, { foreignTable: 'contato' });
                }
            }
            if (debouncedFilters.empreendimentoId.length > 0) query = query.in('empreendimento_id', debouncedFilters.empreendimentoId);
            if (debouncedFilters.clienteId.length > 0) query = query.in('contato_id', debouncedFilters.clienteId);
            if (debouncedFilters.corretorId.length > 0) query = query.in('corretor_id', debouncedFilters.corretorId);
            if (debouncedFilters.status.length > 0) query = query.in('status_contrato', debouncedFilters.status);
            if (debouncedFilters.startDate) query = query.gte('data_venda', debouncedFilters.startDate);
            if (debouncedFilters.endDate) query = query.lte('data_venda', debouncedFilters.endDate);

            if (sortConfig.key && sortConfig.key !== 'contato_nome' && sortConfig.key !== 'empreendimento_nome') {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
            }

            const { data, error } = await query;
            if (error) throw error;

            let mappedData = data.map(c => ({
                ...c,
                produto: c.produto?.[0]?.produtos_empreendimento || null
            }));

            // Ordenação em memória para colunas de tabelas relacionadas (JOINs)
            if (sortConfig.key === 'contato_nome' || sortConfig.key === 'empreendimento_nome') {
                mappedData.sort((a, b) => {
                    let valA = '';
                    let valB = '';
                    
                    if (sortConfig.key === 'contato_nome') {
                        valA = (a.contato?.nome || a.contato?.razao_social || '').toLowerCase();
                        valB = (b.contato?.nome || b.contato?.razao_social || '').toLowerCase();
                    } else if (sortConfig.key === 'empreendimento_nome') {
                        valA = (a.empreendimento?.nome || '').toLowerCase();
                        valB = (b.empreendimento?.nome || '').toLowerCase();
                    }

                    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                });
            }

            return mappedData;
        },
        enabled: !!organizacaoId
    });

    const kpiData = useMemo(() => {
        const kpiDefault = { totalVendido: 0, contratosAssinados: 0, ticketMedio: 0, mediaVendasPorMes: 0, ultimaVenda: null, totalTermos: 0, countTermos: 0 };
        if (!contratos) return kpiDefault;

        // 1. KPI Vendas Efetivas (Contratos Assinados e NÃO Termos)
        const dataVendasEfetivas = contratos.filter(c => {
            const isAssinado = c.status_contrato === 'Assinado';
            const tipoDoc = c.tipo_documento ? c.tipo_documento.toUpperCase() : '';
            return isAssinado && !tipoDoc.includes('TERMO');
        });

        // 2. KPI Termos de Interesse (Assinados/Reservados)
        const dataTermos = contratos.filter(c => {
            const isAssinado = c.status_contrato === 'Assinado';
            const tipoDoc = c.tipo_documento ? c.tipo_documento.toUpperCase() : '';
            return isAssinado && tipoDoc.includes('TERMO');
        });

        // Cálculos Venda
        const totalVendido = dataVendasEfetivas.reduce((acc, contrato) => acc + (parseFloat(contrato.valor_final_venda) || 0), 0);
        const contratosAssinados = dataVendasEfetivas.length;
        const ticketMedio = contratosAssinados > 0 ? totalVendido / contratosAssinados : 0;

        // Cálculos Termos
        const totalTermos = dataTermos.reduce((acc, contrato) => acc + (parseFloat(contrato.valor_final_venda) || 0), 0);
        const countTermos = dataTermos.length;

        // Cálculos Temporais
        let mediaVendasPorMes = 0;
        let ultimaVenda = null;

        if (contratosAssinados > 0) {
            const datasVenda = dataVendasEfetivas.map(c => new Date(c.data_venda));
            const dataMin = new Date(Math.min.apply(null, datasVenda));
            const dataMax = new Date(Math.max.apply(null, datasVenda));
            const diffAnos = dataMax.getFullYear() - dataMin.getFullYear();
            const diffMeses = dataMax.getMonth() - dataMin.getMonth();
            const totalMesesNoPeriodo = (diffAnos * 12) + diffMeses + 1;
            mediaVendasPorMes = totalMesesNoPeriodo > 0 ? contratosAssinados / totalMesesNoPeriodo : 0;

            ultimaVenda = dataVendasEfetivas.reduce((latest, current) => new Date(current.data_venda) > new Date(latest.data_venda) ? current : latest).data_venda;
        }

        return { totalVendido, contratosAssinados, ticketMedio, mediaVendasPorMes, ultimaVenda, totalTermos, countTermos };
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
        <div className="w-full p-4 space-y-6">

            {/* CABEÇALHO UNIFICADO */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-gray-800">Contratos</h2>
                    {contratos?.length > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-2">
                            {contratos.length} gerados
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto mt-4 xl:mt-0">
                    {/* Busca Global */}
                    <div className="relative flex-grow xl:flex-grow-0 min-w-[280px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nº, cliente ou CPF..."
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            className="w-full p-2 pl-10 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                        {filters.searchTerm && (
                            <button onClick={() => setFilters(prev => ({ ...prev, searchTerm: '' }))} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-red-500" title="Limpar busca">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        )}
                    </div>

                    {/* Botão Filtros */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`bg-white border text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors ${showFilters
                                ? 'border-blue-300 text-blue-600 bg-blue-50'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        title="Filtros Avançados"
                    >
                        <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500" : "text-gray-400"} />
                        Filtros
                    </button>

                    {/* Botão Novo */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <FontAwesomeIcon icon={faPlus} /> Novo
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
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <KpiCard
                    title="VGV Possível"
                    value={isLoadingVgv ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvPossivel || 0)}
                    icon={faChartLine}
                    tooltip="Soma dos contratos assinados e unidades disponíveis para empreendimentos listados."
                />
                <KpiCard
                    title="Potencial (Termos)"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalTermos)}
                    icon={faFileSignature}
                    tooltip={`${kpiData.countTermos} termos assinados aguardando conversão.`}
                />
                <KpiCard title="Total Vendido" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalVendido)} icon={faFileInvoiceDollar} />
                <KpiCard title="Assinados" value={kpiData.contratosAssinados} icon={faHandshake} />
                <KpiCard title="Ticket Médio" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.ticketMedio)} icon={faArrowUpRightDots} />
                <KpiCard title="Vendas/Mês" value={kpiData.mediaVendasPorMes.toFixed(2).replace('.', ',')} icon={faChartPie} />
                <KpiCard title="Última Venda" value={formatUltimaVenda(kpiData.ultimaVenda)} icon={faCalendarCheck} />
            </div>

            {/* TABELA */}
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

            {/* MODAL NOVO CONTRATO -- PADRAO OURO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                        {/* Header do Modal Sólido */}
                        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FontAwesomeIcon icon={faFileSignature} />
                                Novo Documento
                            </h3>
                            <button onClick={handleCloseModal} className="text-white/70 hover:text-white transition-colors p-1" title="Fechar">
                                <FontAwesomeIcon icon={faTimes} size="lg" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <label htmlFor="tipoDocumento" className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Negociação</label>
                                <select
                                    id="tipoDocumento"
                                    value={selectedTipoDocumento}
                                    onChange={(e) => setSelectedTipoDocumento(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm text-gray-700 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="CONTRATO">Contrato de Compra e Venda</option>
                                    <option value="TERMO_DE_INTERESSE">Pré-reserva (Termo de Interesse)</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="empreendimento" className="block text-sm font-semibold text-gray-700 mb-2">Empreendimento Vinculado</label>
                                {isLoadingEmpreendimentosModal ? (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 animate-pulse">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Carregando lista de ativos...
                                    </div>
                                ) : empreendimentosParaVenda.length === 0 ? (
                                    <div className="p-4 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 text-center">
                                        Nenhum empreendimento ativo marcado como "Listado para Venda".
                                    </div>
                                ) : (
                                    <select
                                        id="empreendimento"
                                        value={selectedEmpreendimentoId}
                                        onChange={(e) => setSelectedEmpreendimentoId(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm text-gray-700 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">-- Selecione a Obra/Ativo --</option>
                                        {empreendimentosParaVenda.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button type="button" onClick={handleCloseModal} className="px-5 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancelar</button>
                                <button
                                    type="button"
                                    onClick={handleCreateContrato}
                                    disabled={!selectedEmpreendimentoId || !selectedTipoDocumento || isLoadingEmpreendimentosModal || isCreating}
                                    className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-bold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    {isCreating ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Aguarde...</> : 'Criar e Continuar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}