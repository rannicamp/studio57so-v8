//app\(main)\financeiro\page.js
"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs, faShieldAlt, faSpinner, faLock, faBalanceScale, faSitemap, faHandshake, faLandmark, faBuilding, faFileInvoice } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import AtivosManager from '../../../components/financeiro/AtivosManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import ExtratoManager from '../../../components/financeiro/ExtratoManager';
import LancamentoDetalhesSidebar from '../../../components/financeiro/LancamentoDetalhesSidebar';

const supabase = createClient();

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

    return {
        empresas: empresasRes.data || [],
        contas: contasRes.data || [],
        categorias: categoriasRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
        allContacts: contatosRes.data || [],
        funcionarios: funcionariosRes.data || []
    };
}

async function fetchLancamentos({ queryKey }) {
    const [_key, { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }] = queryKey;
    if (!organizacao_id) return { data: [], count: 0 };
    
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    // =================================================================================
    // INÍCIO DA ATUALIZAÇÃO
    // O PORQUÊ: Adicionamos 'anexos:lancamentos_anexos(*)' à string de seleção.
    // Isso instrui o Supabase a buscar não apenas o lançamento, mas também todos os
    // registros da tabela 'lancamentos_anexos' que estão associados a ele.
    // =================================================================================
    const selectString = `*, 
        conta:contas_financeiras(nome), 
        categoria:categorias_financeiras(nome), 
        favorecido:contatos(nome, razao_social), 
        empresa:cadastro_empresa!empresa_id(nome_fantasia, razao_social), 
        empreendimento:empreendimentos(nome),
        anexos:lancamentos_anexos(*)`;
    // =================================================================================
    // FIM DA ATUALIZAÇÃO
    // =================================================================================


    const { data, error, count } = await supabase
        .rpc('consultar_lancamentos_filtrados', { 
            p_organizacao_id: organizacao_id, 
            p_filtros: filters 
        }, { count: 'exact' })
        .select(selectString)
        .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' })
        .range(from, to);

    if (error) {
        console.error("Erro ao buscar lançamentos via RPC:", error);
        throw new Error(error.message);
    }
    
    return { data: data || [], count: count || 0 };
}


async function fetchLancamentosKpi({ queryKey }) {
    const [_key, { filters, organizacao_id }] = queryKey;
    if (!organizacao_id) return [];

    const { data, error } = await supabase
        .rpc('consultar_lancamentos_filtrados', {
            p_organizacao_id: organizacao_id,
            p_filtros: filters
        })
        .select('valor, tipo');

    if (error) throw new Error(error.message);
    return data || [];
}

async function fetchTodosLancamentosParaSaldos({ queryKey }) {
    const [_key, { organizacao_id }] = queryKey;
    if (!organizacao_id) return [];
    
    let query = supabase.from('lancamentos')
        .select('valor, tipo, status, conciliado, conta_id')
        .eq('organizacao_id', organizacao_id)
        .or('status.eq.Pago,conciliado.eq.true');

    const { data, error } = await query;
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
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(150);
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });
    const [filters, setFilters] = useState({ 
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [], 
        etapaIds: [], status: [], tipo: [], startDate: '', 
        endDate: '',
        month: '', year: '', favorecidoId: null 
    });

    useEffect(() => {
        if (!authLoading && canViewPage) {
            setPageTitle('GESTÃO FINANCEIRA');
        } else if (!authLoading && !canViewPage) {
            router.push('/'); 
        }
    }, [authLoading, canViewPage, setPageTitle, router]);

    const { data: initialData, isLoading: isLoadingInitialData } = useQuery({
        queryKey: ['initialFinanceData', organizacao_id],
        queryFn: () => fetchInitialData(organizacao_id),
        enabled: canViewPage && !!organizacao_id,
    });
    const { empresas = [], contas = [], categorias = [], empreendimentos = [], allContacts = [], funcionarios = [] } = initialData || {};

    const { data: lancamentosData, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentos', { filters, currentPage, itemsPerPage, sortConfig, organizacao_id }],
        queryFn: fetchLancamentos,
        enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id,
    });
    const { data: lancamentos = [], count: totalCount = 0 } = lancamentosData || {};
    
    const { data: lancamentosFiltradosKpi = [] } = useQuery({
        queryKey: ['lancamentosKpi', { filters, organizacao_id }],
        queryFn: fetchLancamentosKpi,
        enabled: canViewPage && activeTab === 'lancamentos' && !!organizacao_id,
    });

    const { data: todosLancamentosParaSaldos = [] } = useQuery({
        queryKey: ['saldosData', { organizacao_id }],
        queryFn: fetchTodosLancamentosParaSaldos,
        enabled: canViewPage && !!organizacao_id && (activeTab === 'contas' || activeTab === 'extrato'),
    });

    const deleteLancamentoMutation = useMutation({
        mutationFn: async ({ id, organizacaoId }) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] });
            queryClient.invalidateQueries({ queryKey: ['saldosData'] });
        },
    });

    const handleDeleteLancamento = (id) => {
        toast("Confirmar exclusão", {
            description: "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.",
            action: {
                label: "Excluir",
                onClick: () => toast.promise(deleteLancamentoMutation.mutateAsync({ id, organizacaoId: organizacao_id }), {
                    loading: 'Excluindo...',
                    success: 'Lançamento excluído!',
                    error: (err) => `Erro: ${err.message}`,
                })
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleSuccessForm = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
        queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] });
        queryClient.invalidateQueries({ queryKey: ['saldosData'] });
        queryClient.invalidateQueries({ queryKey: ['initialFinanceData'] });
    };

    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    
    const handleViewLancamentoDetails = (lancamento) => {
        setSelectedLancamento(lancamento);
        setIsDetailsSidebarOpen(true);
    };
    const handleCloseDetailsSidebar = () => {
        setIsDetailsSidebarOpen(false);
        setTimeout(() => setSelectedLancamento(null), 300);
    };

    const TabButton = ({ tabName, label, icon }) => ( 
        <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase flex items-center gap-2 ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <FontAwesomeIcon icon={icon} /> {label}
        </button> 
    );

    if (authLoading || isLoadingInitialData) { 
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>; 
    }
    
    if (!canViewPage) { 
        return ( <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg"> <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" /> <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2> <p className="mt-2 text-red-600">Você não tem permissão para aceder a esta página.</p> </div> ); 
    }

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={handleSuccessForm} initialData={editingLancamento} empresas={empresas} />
            <LancamentoDetalhesSidebar open={isDetailsSidebarOpen} onClose={handleCloseDetailsSidebar} lancamento={selectedLancamento} />
            
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel Financeiro</h1>
                <div className="flex items-center gap-2"> 
                    <Link href="/financeiro/categorias" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faSitemap} /> Categorias</Link>
                    <Link href="/financeiro/conciliacao" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faHandshake} /> Conciliação</Link>
                    <Link href="/financeiro/auditoria" title="Painel de Auditoria" className="text-gray-400 hover:text-orange-500"><FontAwesomeIcon icon={faShieldAlt} /></Link> 
                    <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faCogs} /> Assistente</Link> 
                    {canCreate && (<button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faPlus} /> Novo Lançamento</button>)}
                </div>
            </div>
            
            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="lancamentos" label="Lançamentos" icon={faBalanceScale} />
                    <TabButton tabName="extrato" label="Extrato" icon={faFileInvoice} />
                    <TabButton tabName="contas" label="Contas" icon={faBuilding} />
                    <TabButton tabName="ativos" label="Ativos" icon={faLandmark} />
                </nav>
            </div>
            
            <div className="mt-4">
                {activeTab === 'extrato' && <ExtratoManager contas={contas} onEdit={handleOpenEditModal} />}
                
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos}
                        allLancamentosKpi={lancamentosFiltradosKpi}
                        loading={isLoadingLancamentos}
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
                {activeTab === 'contas' && <ContasManager initialContas={contas} allLancamentos={todosLancamentosParaSaldos} onUpdate={handleSuccessForm} empresas={empresas} />}
                {activeTab === 'ativos' && <AtivosManager />}
            </div>
        </div>
    );
}