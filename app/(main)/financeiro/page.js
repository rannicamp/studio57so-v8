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
    faPlus, faSpinner, faLock, faBalanceScale, 
    faHandshake, faShieldAlt, faBuilding, faFileInvoice, 
    faFilter, faSearch, faCreditCard, faFolderOpen,
    faClipboardList, faLandmark, faCalendarDay, faHistory
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

// Componentes
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import AtivosManager from '../../../components/financeiro/AtivosManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import ExtratoManager from '../../../components/financeiro/ExtratoManager';
import LancamentoDetalhesSidebar from '../../../components/financeiro/LancamentoDetalhesSidebar';
import FiltroFinanceiro from '../../../components/financeiro/FiltroFinanceiro';
import FinanceiroStats from '../../../components/financeiro/FinanceiroStats';
import GerenciadorFaturas from '../../../components/financeiro/GerenciadorFaturas';
import DocumentosManager from '../../../components/financeiro/DocumentosManager';
import PlanejamentoFolha from '../../../components/financeiro/PlanejamentoFolha';

// Hook
import { useLancamentos } from '@/hooks/financeiro/useLancamentos';

const FINANCEIRO_UI_STATE_KEY = 'financeiroUiState';

const getCachedData = (key) => {
    try {
        const cachedData = localStorage.getItem(key);
        return cachedData ? JSON.parse(cachedData) : undefined;
    } catch (error) { return undefined; }
};

async function fetchInitialData(organizacao_id) {
    const supabase = createClient();
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

// === REMOVIDO: function fetchFinanceiroStats === 
// A busca separada de stats foi deletada. Agora usamos a que vem junto com a lista.

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { hasPermission, loading: authLoading, user } = useAuth();
    const organizacao_id = user?.organizacao_id;
    const supabase = createClient();
    
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
        ignoreTransfers: false, ignoreChargebacks: false,
        useCompetencia: false 
    });
    
    const [debouncedFilters] = useDebounce(filters, 600);
    const hasRestoredUiState = useRef(false);

    const toggleCompetenciaView = () => {
        setFilters(prev => {
            const newValue = !prev.useCompetencia;
            if (newValue) {
                setSortConfig({ key: 'data_transacao', direction: 'descending' });
            } else {
                setSortConfig({ key: 'data_vencimento', direction: 'descending' });
            }
            return { ...prev, useCompetencia: newValue };
        });
        toast.info(filters.useCompetencia ? "Alterado para Visão de Caixa (Vencimento/Pagamento)" : "Alterado para Visão de Competência (Data da Transação)");
    };

    useEffect(() => {
        if (hasRestoredUiState.current) setCurrentPage(1);
    }, [debouncedFilters]);

    useEffect(() => {
        if (!authLoading && canViewPage) {
            setPageTitle('GESTÃO FINANCEIRA');
            if (!hasRestoredUiState.current) {
                const savedUiState = getCachedData(FINANCEIRO_UI_STATE_KEY);
                if (savedUiState) {
                    setActiveTab(savedUiState.activeTab || 'lancamentos');
                    setFilters({ 
                        ...savedUiState.filters, 
                        ignoreTransfers: savedUiState.filters?.ignoreTransfers ?? false,
                        ignoreChargebacks: savedUiState.filters?.ignoreChargebacks ?? false,
                        useCompetencia: savedUiState.filters?.useCompetencia ?? false
                    } || {});
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

    const uiStateToSave = { activeTab, filters: debouncedFilters, currentPage, itemsPerPage, sortConfig, showFilters };
    useEffect(() => {
        try { if (hasRestoredUiState.current) localStorage.setItem(FINANCEIRO_UI_STATE_KEY, JSON.stringify(uiStateToSave)); } 
        catch (error) { console.error("Falha ao salvar UI", error); }
    }, [debouncedFilters, currentPage, itemsPerPage, sortConfig, showFilters, activeTab]);

    const { data: initialData, isLoading: isLoadingInitialData } = useQuery({
        queryKey: ['initialFinanceData', organizacao_id],
        queryFn: () => fetchInitialData(organizacao_id),
        enabled: canViewPage && !!organizacao_id,
        staleTime: 300000 
    });

    const { empresas = [], contas = [], categorias = [], empreendimentos = [], allContacts = [], funcionarios = [] } = initialData || {};
    const contasCartao = contas.filter(c => c.tipo === 'Cartão de Crédito');

    const { 
        data: lancamentosQueryData, 
        isLoading: isLoadingLancamentos, 
        isFetching: isRefetching 
    } = useLancamentos({
        filters: debouncedFilters,
        page: currentPage,
        itemsPerPage,
        sortConfig
    });

    // AQUI ESTÁ A MUDANÇA: Pegamos os stats direto do pacote de lançamentos
    const lancamentos = lancamentosQueryData?.data || [];
    const totalCount = lancamentosQueryData?.count || 0;
    const financeiroStats = lancamentosQueryData?.stats || {}; // Stats vêm daqui agora!

    // === REMOVIDO: useQuery separado para stats ===

    const deleteLancamentoMutation = useMutation({
        mutationFn: async ({ id, organizacaoId }) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            handleSuccessForm();
            toast.success('Lançamento excluído!');
        },
        onError: (err) => toast.error(`Erro: ${err.message}`)
    });

    const handleDeleteLancamento = (id) => {
        toast("Confirmar exclusão", {
            description: "Tem certeza que deseja excluir este lançamento?",
            action: { label: "Excluir", onClick: () => deleteLancamentoMutation.mutate({ id, organizacaoId: organizacao_id }) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleSuccessForm = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
        queryClient.invalidateQueries({ queryKey: ['saldosContasReais'] });
        // Não precisamos mais invalidar 'financeiroStats' separado
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
    if (!canViewPage) return <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg"><FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4"><h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2></FontAwesomeIcon></div>;

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={handleSuccessForm} initialData={editingLancamento} empresas={empresas} />
            <LancamentoDetalhesSidebar open={isDetailsSidebarOpen} onClose={handleCloseDetailsSidebar} lancamento={selectedLancamento} />
            
            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6 rounded-lg">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
                        <h1 className="text-3xl font-bold text-gray-800">Financeiro</h1>
                        <div className="flex items-center gap-2 w-full md:w-auto flex-grow">
                             <button 
                                onClick={toggleCompetenciaView}
                                className={`flex-shrink-0 w-10 h-[42px] border rounded-lg flex items-center justify-center transition-all ${
                                    filters.useCompetencia 
                                        ? 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200' 
                                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-blue-600'
                                }`}
                                title={filters.useCompetencia ? "Visualizando por Competência (Transação). Clique para voltar ao Caixa." : "Visualizar por Competência (Data da Transação)"}
                             >
                                <FontAwesomeIcon icon={filters.useCompetencia ? faHistory : faCalendarDay} />
                             </button>

                             <div className="relative flex-grow min-w-[200px]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FontAwesomeIcon icon={faSearch} className="text-gray-400" /></div>
                                <input 
                                    type="text" 
                                    placeholder={filters.useCompetencia ? "Buscar por competência..." : "Buscar lançamentos..."}
                                    value={filters.searchTerm} 
                                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm h-[42px]"
                                />
                             </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto justify-start xl:justify-end">
                        <Link href="/financeiro/conciliacao" className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"><FontAwesomeIcon icon={faHandshake} className="text-green-600 mr-2" /> Conciliação</Link>
                        <Link href="/financeiro/auditoria" className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"><FontAwesomeIcon icon={faShieldAlt} className="text-indigo-600 mr-2" /> Auditoria</Link>
                        <button onClick={() => setShowFilters(!showFilters)} className={`flex-shrink-0 border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}><FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} /> Filtros</button>
                        {canCreate && <button onClick={handleOpenAddModal} className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"><FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo</button>}
                    </div>
                </div>

                {showFilters && activeTab !== 'contas' && activeTab !== 'ativos' && activeTab !== 'planejamento' && (
                    <FiltroFinanceiro filters={filters} setFilters={setFilters} empresas={empresas} contas={contas} categorias={categorias} empreendimentos={empreendimentos} allContacts={allContacts} />
                )}

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        <TabButton tabName="lancamentos" label="Lançamentos" icon={faBalanceScale} />
                        <TabButton tabName="extrato" label="Extrato" icon={faFileInvoice} />
                        <TabButton tabName="cartoes" label="Cartões" icon={faCreditCard} />
                        <TabButton tabName="planejamento" label="Planejamento Folha" icon={faClipboardList} />
                        <TabButton tabName="documentos" label="Documentos" icon={faFolderOpen} />
                        <TabButton tabName="contas" label="Contas" icon={faBuilding} />
                        <TabButton tabName="ativos" label="Ativos" icon={faLandmark} />
                    </nav>
                </div>
            </div>
            
            <div className="mt-4">
                {activeTab === 'extrato' && <ExtratoManager contas={contas} onEdit={handleOpenEditModal} />}
                {activeTab === 'cartoes' && <GerenciadorFaturas contasCartao={contasCartao} />}
                
                {activeTab === 'planejamento' && <PlanejamentoFolha filters={filters} setFilters={setFilters} />} 
                {activeTab === 'documentos' && <DocumentosManager filters={filters} />}

                {activeTab === 'lancamentos' && (
                    <>
                        {/* Agora os Stats vêm da mesma fonte! Loading é o mesmo da lista. */}
                        <FinanceiroStats data={financeiroStats} isLoading={isLoadingLancamentos || isRefetching} />
                        
                        <LancamentosManager 
                            lancamentos={lancamentos}
                            loading={isLoadingLancamentos || isRefetching}
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
                            isCompetenciaMode={filters.useCompetencia}
                        />
                    </>
                )}
                {activeTab === 'contas' && <ContasManager initialContas={contas} onUpdate={handleSuccessForm} empresas={empresas} onVerExtrato={handleIrParaExtrato} />}
                {activeTab === 'ativos' && <AtivosManager />}
            </div>
        </div>
    );
}