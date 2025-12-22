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
    faFilter, faSearch, faTags, faCreditCard 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import AtivosManager from '../../../components/financeiro/AtivosManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import ExtratoManager from '../../../components/financeiro/ExtratoManager';
import LancamentoDetalhesSidebar from '../../../components/financeiro/LancamentoDetalhesSidebar';
import FiltroFinanceiro from '../../../components/financeiro/FiltroFinanceiro';
import FinanceiroStats from '../../../components/financeiro/FinanceiroStats';
import GerenciadorFaturas from '../../../components/financeiro/GerenciadorFaturas'; // <--- IMPORT NOVO

const supabase = await createClient();

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

// Busca dados iniciais (Empresas, Contas, etc)
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

// Busca Lançamentos (Lista Paginada)
async function fetchLancamentos({ queryKey }) {
    const [_key, { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }] = queryKey;
    if (!organizacao_id) return { data: [], count: 0 };

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const selectString = `*, conta:contas_financeiras(nome), categoria:categorias_financeiras(nome), favorecido:contatos(nome, razao_social), empresa:cadastro_empresa!empresa_id(nome_fantasia, razao_social), empreendimento:empreendimentos(nome), anexos:lancamentos_anexos(*)`;

    const { data, error, count } = await supabase.rpc('consultar_lancamentos_filtrados', { 
        p_organizacao_id: organizacao_id, 
        p_filtros: filters 
    }, { count: 'exact' })
    .select(selectString)
    .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' })
    .range(from, to);

    if (error) throw new Error(error.message);
    return { data: data || [], count: count || 0 };
}

// Busca KPIs
async function fetchFinanceiroStats({ queryKey }) {
    const [_key, { filters, organizacao_id }] = queryKey;
    if (!organizacao_id) return [];

    const { data, error } = await supabase.rpc('obter_resumo_financeiro', { 
        p_organizacao_id: organizacao_id, 
        p_filtros: filters 
    });

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
    
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(150);
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });
    
    const [filters, setFilters] = useState({ 
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], 
        empreendimentoIds: [], etapaIds: [], status: [], tipo: [], 
        startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
        ignoreTransfers: false 
    });
    
    const isInitialFetchCompleted = useRef(false);
    const hasRestoredUiState = useRef(false);

    useEffect(() => {
        if (!authLoading && canViewPage) {
            setPageTitle('GESTÃO FINANCEIRA');
            if (!hasRestoredUiState.current) {
                const savedUiState = getCachedData(FINANCEIRO_UI_STATE_KEY);
                if (savedUiState) {
                    setActiveTab(savedUiState.activeTab || 'lancamentos');
                    setFilters({ ...savedUiState.filters, ignoreTransfers: savedUiState.filters?.ignoreTransfers ?? false } || {});
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
        try { if (hasRestoredUiState.current) localStorage.setItem(FINANCEIRO_UI_STATE_KEY, JSON.stringify(debouncedUiState)); } 
        catch (error) { console.error("Falha ao salvar UI", error); }
    }, [debouncedUiState]);

    const { data: initialData, isLoading: isLoadingInitialData } = useQuery({
        queryKey: ['initialFinanceData', organizacao_id],
        queryFn: () => fetchInitialData(organizacao_id),
        enabled: canViewPage && !!organizacao_id,
        staleTime: 300000 
    });

    const { empresas = [], contas = [], categorias = [], empreendimentos = [], allContacts = [], funcionarios = [] } = initialData || {};

    // Filtra apenas contas do tipo Cartão de Crédito para a nova aba
    const contasCartao = contas.filter(c => c.tipo === 'Cartão de Crédito');

    const { data: lancamentosData, isLoading: isLoadingLancamentos, isSuccess, isPlaceholderData } = useQuery({
        queryKey: ['lancamentos', { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }],
        queryFn: fetchLancamentos,
        enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id,
        placeholderData: () => getCachedData(LANCAMENTOS_CACHE_KEY), 
    });

    const { data: lancamentos = [], count: totalCount = 0 } = lancamentosData || {};
    
    useEffect(() => {
        if (lancamentosData && isSuccess && !isPlaceholderData) {
            const hasActiveFilters = Object.values(filters).some(val => Array.isArray(val) ? val.length > 0 : !!val);
            if (!hasActiveFilters) localStorage.setItem(LANCAMENTOS_CACHE_KEY, JSON.stringify(lancamentosData));
            if (!isInitialFetchCompleted.current) isInitialFetchCompleted.current = true;
        }
    }, [lancamentosData, isSuccess, filters, isPlaceholderData]);
    
    const { data: financeiroStats = [], isLoading: isLoadingStats } = useQuery({
        queryKey: ['financeiroStats', { filters, organizacao_id }],
        queryFn: fetchFinanceiroStats,
        enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id
    });

    const deleteLancamentoMutation = useMutation({
        mutationFn: async ({ id, organizacaoId }) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            queryClient.invalidateQueries({ queryKey: ['financeiroStats'] });
            queryClient.invalidateQueries({ queryKey: ['saldosContasReais'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentosCartao'] }); // Atualiza faturas também
        }
    });

    const handleDeleteLancamento = (id) => {
        toast("Confirmar exclusão", {
            description: "Tem certeza que deseja excluir este lançamento?",
            action: {
                label: "Excluir",
                onClick: () => toast.promise(deleteLancamentoMutation.mutateAsync({ id, organizacaoId: organizacao_id }), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}` })
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleSuccessForm = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
        queryClient.invalidateQueries({ queryKey: ['financeiroStats'] });
        queryClient.invalidateQueries({ queryKey: ['saldosContasReais'] });
        queryClient.invalidateQueries({ queryKey: ['initialFinanceData'] });
        queryClient.invalidateQueries({ queryKey: ['lancamentosCartao'] }); // Atualiza aba cartões
    };

    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    const handleViewLancamentoDetails = (lancamento) => { setSelectedLancamento(lancamento); setIsDetailsSidebarOpen(true); };
    const handleCloseDetailsSidebar = () => { setIsDetailsSidebarOpen(false); setTimeout(() => setSelectedLancamento(null), 300); };

    const handleIrParaExtrato = (contaId) => {
        const filterState = { filters: { contaIds: [contaId], startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }, extratoItens: [], saldoAnterior: 0, autoExecutar: true };
        sessionStorage.setItem('lastExtratoState', JSON.stringify(filterState));
        setActiveTab('extrato');
    };

    const TabButton = ({ tabName, label, icon }) => (
        <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase flex items-center gap-2 ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}> <FontAwesomeIcon icon={icon} /> {label} </button>
    );

    if (authLoading || isLoadingInitialData) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    if (!canViewPage) return <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg"><FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" /><h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2></div>;

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={handleSuccessForm} initialData={editingLancamento} empresas={empresas} />
            <LancamentoDetalhesSidebar open={isDetailsSidebarOpen} onClose={handleCloseDetailsSidebar} lancamento={selectedLancamento} />
            
            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6 rounded-lg">
                {/* HEADLINE E FERRAMENTAS */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
                        <h1 className="text-3xl font-bold text-gray-800">Financeiro</h1>
                        <div className="relative flex-grow md:flex-grow-0 min-w-[250px] w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FontAwesomeIcon icon={faSearch} className="text-gray-400" /></div>
                            <input type="text" placeholder="Buscar lançamentos..." value={filters.searchTerm} onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"/>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto justify-start xl:justify-end">
                        <Link href="/financeiro/conciliacao" className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"><FontAwesomeIcon icon={faHandshake} className="text-green-600 mr-2" /> Conciliação</Link>
                        <Link href="/financeiro/auditoria" className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"><FontAwesomeIcon icon={faShieldAlt} className="text-indigo-600 mr-2" /> Auditoria</Link>
                        <Link href="/financeiro/categorias" className="flex-shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center transition duration-200"><FontAwesomeIcon icon={faTags} className="mr-2" /> Categorias</Link>
                        <button onClick={() => setShowFilters(!showFilters)} className={`flex-shrink-0 border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}><FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} /> Filtros</button>
                        <Link href="/configuracoes/financeiro/importar" className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"><FontAwesomeIcon icon={faCogs} className="text-purple-500 mr-2" /> Assistente</Link>
                        {canCreate && <button onClick={handleOpenAddModal} className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"><FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo</button>}
                    </div>
                </div>

                {showFilters && activeTab === 'lancamentos' && (
                    <FiltroFinanceiro filters={filters} setFilters={setFilters} empresas={empresas} contas={contas} categorias={categorias} empreendimentos={empreendimentos} allContacts={allContacts} />
                )}

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <TabButton tabName="lancamentos" label="Lançamentos" icon={faBalanceScale} />
                        <TabButton tabName="extrato" label="Extrato" icon={faFileInvoice} />
                        {/* NOVA ABA CARTÕES */}
                        <TabButton tabName="cartoes" label="Cartões" icon={faCreditCard} />
                        <TabButton tabName="contas" label="Contas" icon={faBuilding} />
                        <TabButton tabName="ativos" label="Ativos" icon={faLandmark} />
                    </nav>
                </div>
            </div>
            
            <div className="mt-4">
                {activeTab === 'extrato' && <ExtratoManager contas={contas} onEdit={handleOpenEditModal} />}
                
                {/* RENDERIZA O GERENCIADOR DE FATURAS */}
                {activeTab === 'cartoes' && <GerenciadorFaturas contasCartao={contasCartao} />}

                {activeTab === 'lancamentos' && (
                    <>
                        <FinanceiroStats data={financeiroStats} isLoading={isLoadingStats} />
                        
                        <LancamentosManager 
                            lancamentos={lancamentos}
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
                    </>
                )}
                {activeTab === 'contas' && <ContasManager initialContas={contas} onUpdate={handleSuccessForm} empresas={empresas} onVerExtrato={handleIrParaExtrato} />}
                {activeTab === 'ativos' && <AtivosManager />}
            </div>
        </div>
    );
}