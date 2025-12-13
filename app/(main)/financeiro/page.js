// app/(main)/financeiro/page.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faCogs, faShieldAlt, faSpinner, faLock, faBalanceScale, 
    faSitemap, faHandshake, faLandmark, faBuilding, faFileInvoice, 
    faFilter, faSearch, faLayerGroup 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import AtivosManager from '../../../components/financeiro/AtivosManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import ExtratoManager from '../../../components/financeiro/ExtratoManager';
import LancamentoDetalhesSidebar from '../../../components/financeiro/LancamentoDetalhesSidebar';
import FiltroFinanceiro from '../../../components/financeiro/FiltroFinanceiro'; // Importado

const supabase = createClient();

const LANCAMENTOS_CACHE_KEY = 'financeiroLancamentosData';
const FINANCEIRO_UI_STATE_KEY = 'financeiroUiState';

const getCachedData = (key) => {
    try {
        const cachedData = localStorage.getItem(key);
        return cachedData ? JSON.parse(cachedData) : undefined;
    } catch (error) {
        return undefined;
    }
};

async function fetchInitialData(organizacao_id) {
    if (!organizacao_id) return { empresas: [], contas: [], categorias: [], empreendimentos: [], allContacts: [], funcionarios: [] };
    const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes, funcionariosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('*').eq('organizacao_id', organizacao_id).order('nome_fantasia'),
        supabase.from('contas_financeiras').select('*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social), conta_debito_fatura:contas_financeiras!conta_debito_fatura_id(id, nome)').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('categorias_financeiras').select('*').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('empreendimentos').select('*, empresa:cadastro_empresa!empresa_proprietaria_id(nome_fantasia, razao_social)').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacao_id).order('full_name')
    ]);
    return { empresas: empresasRes.data || [], contas: contasRes.data || [], categorias: categoriasRes.data || [], empreendimentos: empreendimentosRes.data || [], allContacts: contatosRes.data || [], funcionarios: funcionariosRes.data || [] };
}

async function fetchLancamentos({ queryKey }) {
    const [_key, { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }] = queryKey;
    if (!organizacao_id) return { data: [], count: 0 };
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const selectString = `*, conta:contas_financeiras(nome), categoria:categorias_financeiras(nome), favorecido:contatos(nome, razao_social), empresa:cadastro_empresa!empresa_id(nome_fantasia, razao_social), empreendimento:empreendimentos(nome), anexos:lancamentos_anexos(*)`;
    const { data, error, count } = await supabase.rpc('consultar_lancamentos_filtrados', { p_organizacao_id: organizacao_id, p_filtros: filters }, { count: 'exact' }).select(selectString).order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' }).range(from, to);
    if (error) throw new Error(error.message);
    return { data: data || [], count: count || 0 };
}

async function fetchLancamentosKpi({ queryKey }) {
    const [_key, { filters, organizacao_id }] = queryKey;
    if (!organizacao_id) return [];
    const { data, error } = await supabase.rpc('consultar_lancamentos_filtrados', { p_organizacao_id: organizacao_id, p_filtros: filters }).select('valor, tipo, transferencia_id, categoria:categorias_financeiras(nome)');
    if (error) throw new Error(error.message);
    return data || [];
}

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { hasPermission, loading: authLoading, user } = useAuth();
    const organizacao_id = user?.organizacao_id;
    
    const canViewPage = hasPermission('financeiro', 'pode_ver');
    const canCreate = hasPermission('financeiro', 'pode_criar');

    const [activeTab, setActiveTab] = useState('lancamentos');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);
    const [selectedLancamento, setSelectedLancamento] = useState(null);
    
    // Estado de Filtros e UI
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(150);
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });
    const [filters, setFilters] = useState({ searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [], etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null });
    
    const isInitialFetchCompleted = useRef(false);
    const hasRestoredUiState = useRef(false);

    useEffect(() => {
        if (!authLoading && canViewPage) {
            setPageTitle('GESTÃO FINANCEIRA');
            if (!hasRestoredUiState.current) {
                const savedUiState = getCachedData(FINANCEIRO_UI_STATE_KEY);
                if (savedUiState) {
                    setActiveTab(savedUiState.activeTab || 'lancamentos');
                    setFilters(savedUiState.filters || {});
                    setCurrentPage(savedUiState.currentPage || 1);
                    setItemsPerPage(savedUiState.itemsPerPage || 150);
                    setSortConfig(savedUiState.sortConfig || { key: 'data_vencimento', direction: 'descending' });
                    setShowFilters(savedUiState.showFilters || false);
                }
                hasRestoredUiState.current = true;
            }
        } else if (!authLoading && !canViewPage) {
            router.push('/'); 
        }
    }, [authLoading, canViewPage, setPageTitle, router]);

    const uiStateToSave = { activeTab, filters, currentPage, itemsPerPage, sortConfig, showFilters };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);
    
    useEffect(() => {
        try { localStorage.setItem(FINANCEIRO_UI_STATE_KEY, JSON.stringify(debouncedUiState)); } catch (error) { console.error("Falha ao salvar UI", error); }
    }, [debouncedUiState]);

    const { data: initialData, isLoading: isLoadingInitialData } = useQuery({ queryKey: ['initialFinanceData', organizacao_id], queryFn: () => fetchInitialData(organizacao_id), enabled: canViewPage && !!organizacao_id, staleTime: 300000 });
    const { empresas = [], contas = [], categorias = [], empreendimentos = [], allContacts = [], funcionarios = [] } = initialData || {};

    const { data: lancamentosData, isLoading: isLoadingLancamentos, isSuccess } = useQuery({ queryKey: ['lancamentos', { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }], queryFn: fetchLancamentos, enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id, placeholderData: () => getCachedData(LANCAMENTOS_CACHE_KEY) });
    const { data: lancamentos = [], count: totalCount = 0 } = lancamentosData || {};
    
    useEffect(() => {
        if (lancamentosData && isSuccess) {
            const hasActiveFilters = Object.values(filters).some(val => Array.isArray(val) ? val.length > 0 : !!val);
            if (hasActiveFilters) return; 
            localStorage.setItem(LANCAMENTOS_CACHE_KEY, JSON.stringify(lancamentosData));
            if (!isInitialFetchCompleted.current) isInitialFetchCompleted.current = true;
        }
    }, [lancamentosData, isSuccess, filters]);
    
    const { data: lancamentosFiltradosKpi = [] } = useQuery({ queryKey: ['lancamentosKpi', { filters, organizacao_id }], queryFn: fetchLancamentosKpi, enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id });

    const deleteLancamentoMutation = useMutation({ mutationFn: async ({ id, organizacaoId }) => { const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId); if (error) throw new Error(error.message); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] }); queryClient.invalidateQueries({ queryKey: ['saldosContasReais'] }); } });
    const handleDeleteLancamento = (id) => { toast("Confirmar exclusão", { description: "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.", action: { label: "Excluir", onClick: () => toast.promise(deleteLancamentoMutation.mutateAsync({ id, organizacaoId: organizacao_id }), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}` }) }, cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' } }); };
    const handleSuccessForm = () => { queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] }); queryClient.invalidateQueries({ queryKey: ['saldosContasReais'] }); queryClient.invalidateQueries({ queryKey: ['initialFinanceData'] }); };
    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    const handleViewLancamentoDetails = (lancamento) => { setSelectedLancamento(lancamento); setIsDetailsSidebarOpen(true); };
    const handleCloseDetailsSidebar = () => { setIsDetailsSidebarOpen(false); setTimeout(() => setSelectedLancamento(null), 300); };

    const handleIrParaExtrato = (contaId) => {
        const contaSelecionada = contas.find(c => c.id === contaId);
        let startDate, endDate; const today = new Date();
        if (contaSelecionada?.tipo === 'Cartão de Crédito' && contaSelecionada?.dia_fechamento_fatura) {
            const diaFechamento = contaSelecionada.dia_fechamento_fatura;
            const dataFechamentoEsteMes = new Date(today.getFullYear(), today.getMonth(), diaFechamento);
            const todayZero = new Date(today.setHours(0,0,0,0));
            const fechamentoZero = new Date(dataFechamentoEsteMes.setHours(0,0,0,0));
            if (todayZero < fechamentoZero) { startDate = new Date(today.getFullYear(), today.getMonth() - 1, diaFechamento); endDate = new Date(dataFechamentoEsteMes); endDate.setDate(endDate.getDate() - 1); } else { startDate = new Date(dataFechamentoEsteMes); endDate = new Date(today.getFullYear(), today.getMonth() + 1, diaFechamento); endDate.setDate(endDate.getDate() - 1); }
            toast.info("Visualizando fatura aberta do cartão.");
        } else { endDate = new Date(); startDate = new Date(); startDate.setDate(endDate.getDate() - 30); toast.info("Visualizando extrato dos últimos 30 dias."); }
        const filterState = { filters: { contaIds: [contaId], startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] }, extratoItens: [], saldoAnterior: 0, autoExecutar: true };
        sessionStorage.setItem('lastExtratoState', JSON.stringify(filterState));
        setActiveTab('extrato');
    };

    const TabButton = ({ tabName, label, icon }) => ( <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase flex items-center gap-2 ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}> <FontAwesomeIcon icon={icon} /> {label} </button> );

    if (authLoading || isLoadingInitialData) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>; }
    if (!canViewPage) { return ( <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg"> <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" /> <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2> <p className="mt-2 text-red-600">Você não tem permissão para aceder a esta página.</p> </div> ); }

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={handleSuccessForm} initialData={editingLancamento} empresas={empresas} />
            <LancamentoDetalhesSidebar open={isDetailsSidebarOpen} onClose={handleCloseDetailsSidebar} lancamento={selectedLancamento} />
            
            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6 rounded-lg">
                {/* HEADLINE E FERRAMENTAS - Padrão Ouro */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-800">Financeiro</h1>
                        <div className="hidden md:flex gap-2">
                            <Link href="/financeiro/conciliacao" className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 text-xs font-semibold flex items-center gap-1"><FontAwesomeIcon icon={faHandshake} /> Conciliação</Link>
                            <Link href="/financeiro/auditoria" className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 text-xs font-semibold flex items-center gap-1"><FontAwesomeIcon icon={faShieldAlt} /> Auditoria</Link>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                        <div className="relative flex-grow xl:flex-grow-0 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar lançamentos..." 
                                value={filters.searchTerm} 
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        <button onClick={() => setShowFilters(!showFilters)} className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`} title="Filtros Avançados">
                            <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} /> Filtros
                        </button>

                        <div className="h-8 w-px bg-gray-300 mx-1 hidden md:block"></div>

                        <Link href="/configuracoes/financeiro/importar" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200" title="Importar">
                            <FontAwesomeIcon icon={faCogs} className="text-purple-500 mr-2" /> Assistente
                        </Link>
                        
                        {canCreate && (
                            <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200">
                                <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo
                            </button>
                        )}
                    </div>
                </div>

                {/* PAINEL DE FILTROS */}
                {showFilters && activeTab === 'lancamentos' && (
                    <FiltroFinanceiro 
                        filters={filters} setFilters={setFilters} empresas={empresas} contas={contas} 
                        categorias={categorias} empreendimentos={empreendimentos} allContacts={allContacts} 
                    />
                )}

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <TabButton tabName="lancamentos" label="Lançamentos" icon={faBalanceScale} />
                        <TabButton tabName="extrato" label="Extrato" icon={faFileInvoice} />
                        <TabButton tabName="contas" label="Contas" icon={faBuilding} />
                        <TabButton tabName="ativos" label="Ativos" icon={faLandmark} />
                    </nav>
                </div>
            </div>
            
            <div className="mt-4">
                {activeTab === 'extrato' && <ExtratoManager contas={contas} onEdit={handleOpenEditModal} />}
                
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos}
                        allLancamentosKpi={lancamentosFiltradosKpi}
                        loading={isLoadingLancamentos && !lancamentos.length}
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
                        onUpdate={handleSuccessForm}
                        onRowClick={handleViewLancamentoDetails}
                    />
                )}
                {activeTab === 'contas' && <ContasManager initialContas={contas} onUpdate={handleSuccessForm} empresas={empresas} onVerExtrato={handleIrParaExtrato} />}
                {activeTab === 'ativos' && <AtivosManager />}
            </div>
        </div>
    );
}