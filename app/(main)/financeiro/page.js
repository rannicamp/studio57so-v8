"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import KpiCard from '../../../components/KpiCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs, faShieldAlt, faCalculator, faSpinner, faChartLine, faLock } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';

// Helper para formatar os valores dos KPIs
const formatKpiValue = (value, format) => {
    if (value === null || value === undefined || isNaN(value)) return '--';
    try {
        if (format === 'moeda') {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        }
        if (format === 'porcentagem') {
            const finalValue = value > 1 ? value : value * 100;
            return `${finalValue.toFixed(2)}%`;
        }
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
    } catch (e) {
        return 'Erro';
    }
};

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento } = useEmpreendimento();
    const supabase = createClient();
    const router = useRouter();
    const { hasPermission, loading: authLoading } = useAuth(); // <<< 1. Importar o hook de permissão

    // Permissões
    const canViewPage = hasPermission('financeiro', 'pode_ver');
    const canCreate = hasPermission('financeiro', 'pode_criar');

    const [activeTab, setActiveTab] = useState('lancamentos');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const [empresas, setEmpresas] = useState([]);
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [lancamentos, setLancamentos] = useState([]);
    const [allLancamentosKpi, setAllLancamentosKpi] = useState([]);
    const [allContacts, setAllContacts] = useState([]);
    const [funcionarios, setFuncionarios] = useState([]);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    
    const [filters, setFilters] = useState({
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
        etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '',
    });

    const [sortConfig, setSortConfig] = useState({ key: 'data_transacao', direction: 'descending' });

    const [dashboardKpis, setDashboardKpis] = useState([]);
    const [loadingKpis, setLoadingKpis] = useState(true);

    // <<< 2. Efeito para verificar permissão e redirecionar
    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/'); // Redireciona para o painel se não tiver permissão
        }
    }, [authLoading, canViewPage, router]);


    useEffect(() => {
        const { month, year, startDate: currentStartDate, endDate: currentEndDate } = filters;
        if (year) {
            const newStartDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
            const newEndDate = month ? new Date(year, month, 0) : new Date(year, 11, 31);
            const newStartDateStr = newStartDate.toISOString().split('T')[0];
            const newEndDateStr = newEndDate.toISOString().split('T')[0];

            if (currentStartDate !== newStartDateStr || currentEndDate !== newEndDateStr) {
                setFilters(prev => ({ ...prev, startDate: newStartDateStr, endDate: newEndDateStr }));
            }
        } else if (!month && (currentStartDate || currentEndDate)) {
        }
    }, [filters]);

    const applyFiltersToQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
        if (currentFilters.startDate) query = query.or(`data_transacao.gte.${currentFilters.startDate},data_vencimento.gte.${currentFilters.startDate}`);
        if (currentFilters.endDate) query = query.or(`data_transacao.lte.${currentFilters.endDate},data_vencimento.lte.${currentFilters.endDate}`);
        if (currentFilters.empresaIds?.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
        if (currentFilters.contaIds?.length > 0) query = query.in('conta_id', currentFilters.contaIds);
        if (currentFilters.categoriaIds?.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
        if (currentFilters.empreendimentoIds?.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
        if (currentFilters.etapaIds?.length > 0) query = query.in('etapa_id', currentFilters.etapaIds);
        if (currentFilters.status?.length > 0) {
            const hasAtrasada = currentFilters.status.includes('Atrasada');
            const otherStatus = currentFilters.status.filter(s => s !== 'Atrasada');
            const today = new Date().toISOString().split('T')[0];
            const orConditions = [];
            if (otherStatus.length > 0) orConditions.push(`status.in.(${otherStatus.join(',')})`);
            if (hasAtrasada) orConditions.push(`and(status.eq.Pendente,data_vencimento.lt.${today})`);
            if (orConditions.length > 0) query = query.or(orConditions.join(','));
        }
        if (currentFilters.tipo?.length > 0) {
            query = query.in('tipo', currentFilters.tipo);
        }
        return query;
    }, []);

    const fetchLancamentos = useCallback(async () => {
        setLoading(true);
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const selectString = `
            *,
            conta:contas_financeiras!conta_id(*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social)),
            categoria:categorias_financeiras(*),
            favorecido:contatos!favorecido_contato_id(*),
            empreendimento:empreendimentos(*, empresa:cadastro_empresa!empresa_proprietaria_id(id, nome_fantasia, razao_social)),
            anexos:lancamentos_anexos(*)
        `;

        let query = supabase
            .from('lancamentos')
            .select(selectString, { count: 'exact' })
            .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' })
            .range(from, to);
        
        query = applyFiltersToQuery(query, filters);
        const { data, error, count } = await query;
        if (error) { 
            console.error("Erro ao buscar lançamentos:", error);
            setMessage(`Falha ao carregar dados: ${error.message}`);
        } else {
            setLancamentos(data || []);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [currentPage, itemsPerPage, sortConfig, filters, supabase, applyFiltersToQuery]);

    const fetchAllLancamentosForKpi = useCallback(async () => {
        let query = supabase.from('lancamentos').select('valor, tipo, status, data_pagamento, data_vencimento, conciliado, conta_id, conta_destino_id');
        query = applyFiltersToQuery(query, filters);
        const { data, error } = await query;
        if (error) { console.error("Erro ao buscar dados para KPI:", error); } 
        else { setAllLancamentosKpi(data || []); }
    }, [filters, supabase, applyFiltersToQuery]);
    
    const fetchDashboardKpis = useCallback(async () => {
        if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
            setDashboardKpis([]);
            return;
        }

        setLoadingKpis(true);
        const kpiResults = [];

        const { data: orcamento } = await supabase.from('orcamentos').select('custo_total_previsto').eq('empreendimento_id', selectedEmpreendimento).order('created_at', { ascending: false }).limit(1).single();
        const custoPrevisto = orcamento?.custo_total_previsto || 0;

        const { data: despesas } = await supabase.from('lancamentos').select('valor').eq('empreendimento_id', selectedEmpreendimento).eq('tipo', 'Despesa');
        const custoReal = despesas ? despesas.reduce((acc, item) => acc + (item.valor || 0), 0) : 0;
        
        const percentualObra = custoPrevisto > 0 ? (custoReal / custoPrevisto) : 0;
        
        kpiResults.push({
            id: 'obra-percent',
            nome_kpi: '% da Obra (Gasto)',
            value: percentualObra,
            formato_exibicao: 'porcentagem',
            icon: faChartLine,
            color: 'purple'
        });

        const { data: kpisData } = await supabase.from('kpis_financeiros').select('*');
        if (kpisData) {
            for (const kpi of kpisData) {
                const { data, error } = await supabase.rpc('calcular_kpi', { p_kpi_id: kpi.id });
                kpiResults.push({
                    ...kpi,
                    value: error ? null : data,
                    error: error?.message,
                    icon: faCalculator,
                    color: 'blue'
                });
            }
        }
        
        setDashboardKpis(kpiResults);
        setLoadingKpis(false);
    }, [selectedEmpreendimento, supabase]);

    const fetchInitialData = useCallback(async () => {
        const [
            empresasRes, 
            contasRes, 
            categoriasRes, 
            empreendimentosRes, 
            contatosRes,
            funcionariosRes
        ] = await Promise.all([
            supabase.from('cadastro_empresa').select('*').order('nome_fantasia'),
            supabase.from('contas_financeiras').select('*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social)').order('nome'),
            supabase.from('categorias_financeiras').select('*').order('nome'),
            supabase.from('empreendimentos').select('*, empresa:cadastro_empresa!empresa_proprietaria_id(nome_fantasia, razao_social)').order('nome'),
            supabase.from('contatos').select('id, nome, razao_social').order('nome'),
            supabase.from('funcionarios').select('id, full_name').order('full_name')
        ]);
        
        setEmpresas(empresasRes.data || []);
        setContas(contasRes.data || []);
        setCategorias(categoriasRes.data || []);
        setEmpreendimentos(empreendimentosRes.data || []);
        setAllContacts(contatosRes.data || []);
        setFuncionarios(funcionariosRes.data || []);
    }, [supabase]);
    
    useEffect(() => {
        if (!authLoading && canViewPage) {
            setPageTitle('GESTÃO FINANCEIRA');
            fetchInitialData();
        }
    }, [setPageTitle, fetchInitialData, authLoading, canViewPage]);
    
    useEffect(() => {
        if (canViewPage) {
            fetchLancamentos();
            fetchAllLancamentosForKpi();
        }
    }, [fetchLancamentos, fetchAllLancamentosForKpi, canViewPage]);
    
    useEffect(() => {
        if (canViewPage) {
            fetchDashboardKpis();
        }
    }, [selectedEmpreendimento, fetchDashboardKpis, canViewPage]);

    const handleSuccess = () => {
        fetchLancamentos();
        fetchAllLancamentosForKpi();
        fetchInitialData();
    };
    
    const handleDeleteLancamento = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if(error) {setMessage('Erro ao excluir: ' + error.message);} 
        else { setMessage('Lançamento excluído.'); fetchLancamentos(); fetchAllLancamentosForKpi(); }
    };
    
    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    const TabButton = ({ tabName, label }) => ( <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}> {label} </button> );

    // <<< 3. Se ainda estiver a carregar ou se não tiver permissão, mostrar uma mensagem
    if (authLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    }

    if (!canViewPage) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para aceder a esta página.</p>
            </div>
        );
    }

    // O resto do return continua igual
    return (
        <div className="space-y-6">
            <LancamentoFormModal 
                isOpen={isFormModalOpen} 
                onClose={() => setIsFormModalOpen(false)} 
                onSuccess={handleSuccess} 
                initialData={editingLancamento} 
                empresas={empresas} 
            />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel Financeiro</h1>
                {activeTab === 'lancamentos' && (
                    <div className="flex items-center gap-2">
                         <Link href="/financeiro/auditoria" title="Painel de Auditoria" className="text-gray-400 hover:text-orange-500"><FontAwesomeIcon icon={faShieldAlt} /></Link>
                         <Link href="/financeiro/transferencias" className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2 uppercase">Identificar Transferências</Link>
                         <Link href="/financeiro/kpi-builder" className="bg-cyan-500 text-white px-4 py-2 rounded-md hover:bg-cyan-600 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faCalculator} /> KPIs</Link>
                         <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faCogs} /> Assistente</Link>
                         {/* <<< 4. Ocultar o botão se não tiver permissão para criar */}
                         {canCreate && (
                            <button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faPlus} /> Novo Lançamento</button>
                         )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loadingKpis ? (
                    <div className="col-span-full text-center p-4"><FontAwesomeIcon icon={faSpinner} spin /> Carregando KPIs...</div>
                ) : dashboardKpis.length > 0 ? (
                    dashboardKpis.map(kpi => (
                        <KpiCard
                            key={kpi.id}
                            title={kpi.nome_kpi}
                            value={kpi.error ? 'Erro!' : formatKpiValue(kpi.value, kpi.formato_exibicao)}
                            icon={kpi.icon}
                            color={kpi.color}
                        />
                    ))
                ) : (
                    <div className="col-span-full bg-gray-50 p-4 rounded-lg text-center text-sm text-gray-500">
                        Selecione um empreendimento no cabeçalho para ver os KPIs.
                    </div>
                )}
            </div>

            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="lancamentos" label="Lançamentos" />
                    <TabButton tabName="conciliacao" label="Conciliação Bancária" />
                    <TabButton tabName="contas" label="Contas" />
                    <TabButton tabName="categorias" label="Categorias" />
                </nav>
            </div>
            {message && <p className={`text-center p-2 rounded-md text-sm uppercase font-semibold ${message.includes('ERRO') || message.includes('Falha') ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}
            <div className="mt-4">
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos}
                        allLancamentosKpi={allLancamentosKpi}
                        loading={loading}
                        contas={contas}
                        categorias={categorias}
                        empreendimentos={empreendimentos}
                        empresas={empresas}
                        funcionarios={funcionarios}
                        allContacts={allContacts}
                        filters={filters}
                        setFilters={setFilters}
                        sortConfig={sortConfig}
                        setSortConfig={setSortConfig}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        setItemsPerPage={setItemsPerPage}
                        totalCount={totalCount}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteLancamento}
                        onUpdate={fetchLancamentos}
                    />
                )}
                {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} />}
                {activeTab === 'contas' && <ContasManager initialContas={contas} allLancamentos={allLancamentosKpi} onUpdate={fetchInitialData} empresas={empresas} />}
                {activeTab === 'categorias' && <CategoriasManager />}
            </div>
        </div>
    );
}