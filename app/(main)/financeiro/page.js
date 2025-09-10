"use client";

import { useState, useCallback, useEffect } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs, faShieldAlt, faCalculator, faSpinner, faLock, faBalanceScale, faSitemap, faHandshake, faLandmark, faBuilding, faFileInvoice } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import AtivosManager from '../../../components/financeiro/AtivosManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import ExtratoManager from '../../../components/financeiro/ExtratoManager';

// =================================
// FUNÇÕES DE BUSCA DE DADOS (API)
// =================================

const supabase = createClient();

async function fetchInitialData() {
    const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes, funcionariosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('*').order('nome_fantasia'),
        supabase.from('contas_financeiras').select('*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social), conta_debito_fatura:contas_financeiras!conta_debito_fatura_id(id, nome)').order('nome'),
        supabase.from('categorias_financeiras').select('*').order('nome'),
        supabase.from('empreendimentos').select('*, empresa:cadastro_empresa!empresa_proprietaria_id(nome_fantasia, razao_social)').order('nome'),
        supabase.from('contatos').select('id, nome, razao_social').order('nome'),
        supabase.from('funcionarios').select('id, full_name').order('full_name')
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

const applyFiltersToQuery = (query, currentFilters) => {
    if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
    
    if (currentFilters.startDate || currentFilters.endDate) {
        const startDate = currentFilters.startDate || '1970-01-01';
        const endDate = currentFilters.endDate || new Date().toISOString().split('T')[0];
        
        const pagoInRange = `and(status.eq.Pago,data_pagamento.gte.${startDate},data_pagamento.lte.${endDate})`;
        const pendenteInRange = `and(status.neq.Pago,data_vencimento.gte.${startDate},data_vencimento.lte.${endDate})`;
        query = query.or(`${pagoInRange},${pendenteInRange}`);
    }

    if (currentFilters.empresaIds?.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
    if (currentFilters.contaIds?.length > 0) { query = query.in('conta_id', currentFilters.contaIds); }
    if (currentFilters.categoriaIds?.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
    if (currentFilters.empreendimentoIds?.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
    if (currentFilters.etapaIds?.length > 0) query = query.in('etapa_id', currentFilters.etapaIds);
    if (currentFilters.favorecidoId) query = query.eq('favorecido_contato_id', currentFilters.favorecidoId);
    
    if (currentFilters.status?.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const orConditions = [];
        const hasPago = currentFilters.status.includes('Pago');
        const hasPendente = currentFilters.status.includes('Pendente');
        const hasAtrasada = currentFilters.status.includes('Atrasada');
        const hasAReceber = currentFilters.status.includes('A Receber');
        const otherStatus = currentFilters.status.filter(s => !['Pago', 'Pendente', 'Atrasada', 'A Receber'].includes(s));
        if(otherStatus.length > 0) { orConditions.push(`status.in.(${otherStatus.join(',')})`); }
        if(hasPago) orConditions.push(`status.eq.Pago`);
        if (hasPendente) { orConditions.push(`and(status.eq.Pendente,tipo.eq.Despesa,data_vencimento.gte.${today})`); }
        if (hasAtrasada) { orConditions.push(`and(status.eq.Pendente,data_vencimento.lt.${today})`); }
        if (hasAReceber) { orConditions.push(`and(tipo.eq.Receita,status.eq.Pendente,data_vencimento.gte.${today})`); }
        if (orConditions.length > 0) { query = query.or(orConditions.join(',')); }
    }

    if (currentFilters.tipo?.length > 0) { query = query.in('tipo', currentFilters.tipo); }
    return query;
};

async function fetchLancamentos({ queryKey }) {
    const [_key, { filters, currentPage, itemsPerPage, sortConfig }] = queryKey;
    
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    const selectString = `*, data_pagamento, conta:contas_financeiras!conta_id(*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social)), categoria:categorias_financeiras(*), favorecido:contatos!favorecido_contato_id(*), empreendimento:empreendimentos(*, empresa:cadastro_empresa!empresa_proprietaria_id(id, nome_fantasia, razao_social)), anexos:lancamentos_anexos(*)`;
    
    let query = supabase.from('lancamentos').select(selectString, { count: 'exact' }).order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' }).range(from, to);
    query = applyFiltersToQuery(query, filters);
    
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    
    return { data: data || [], count: count || 0 };
}

async function fetchLancamentosKpi({ queryKey }) {
    const [_key, { filters }] = queryKey;
    let query = supabase.from('lancamentos').select('valor, tipo');
    query = applyFiltersToQuery(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

async function fetchTodosLancamentosParaSaldos({ queryKey }) {
    const [_key, contas] = queryKey;
    if (!contas || contas.length === 0) return [];
    
    const empresaIds = [...new Set(contas.map(c => c.empresa_id).filter(Boolean))];
    let query = supabase.from('lancamentos').select('valor, tipo, status, conciliado, conta_id').or('status.eq.Pago,conciliado.eq.true');
          
    if (empresaIds.length > 0) {
        query = query.in('empresa_id', empresaIds);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

// =================================
// COMPONENTE DA PÁGINA
// =================================

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { hasPermission, loading: authLoading } = useAuth();
    
    const canViewPage = hasPermission('financeiro', 'pode_ver');
    const canCreate = hasPermission('financeiro', 'pode_criar');

    const [activeTab, setActiveTab] = useState('contas');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    
    // ***** INÍCIO DA CORREÇÃO 1/2 *****
    const [currentPage, setCurrentPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedState = sessionStorage.getItem('lancamentosState');
            return savedState ? JSON.parse(savedState).currentPage : 1;
        }
        return 1;
    });

    // O valor padrão de itemsPerPage agora é 150.
    const [itemsPerPage, setItemsPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedState = sessionStorage.getItem('lancamentosState');
            return savedState ? JSON.parse(savedState).itemsPerPage : 150;
        }
        return 150;
    });

    const [sortConfig, setSortConfig] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedState = sessionStorage.getItem('lancamentosState');
            return savedState ? JSON.parse(savedState).sortConfig : { key: 'data_vencimento', direction: 'descending' };
        }
        return { key: 'data_vencimento', direction: 'descending' };
    });
    
    const [filters, setFilters] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedState = sessionStorage.getItem('lancamentosState');
            if (savedState) {
                return JSON.parse(savedState).filters;
            }
        }
        return { 
            searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [], 
            etapaIds: [], status: [], tipo: [], startDate: '', 
            endDate: new Date().toISOString().split('T')[0],
            month: '', year: '', favorecidoId: null 
        };
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stateToSave = {
                filters,
                currentPage,
                itemsPerPage,
                sortConfig
            };
            sessionStorage.setItem('lancamentosState', JSON.stringify(stateToSave));
        }
    }, [filters, currentPage, itemsPerPage, sortConfig]);
    // ***** FIM DA CORREÇÃO 1/2 *****

    useEffect(() => {
      if (!authLoading && canViewPage) {
        setPageTitle('GESTÃO FINANCEIRA');
      }
    }, [authLoading, canViewPage, setPageTitle]);
    
    useEffect(() => { 
        if (!authLoading && !canViewPage) { 
            router.push('/'); 
        } 
    }, [authLoading, canViewPage, router]);

    const { data: initialData, isLoading: isLoadingInitialData } = useQuery({
        queryKey: ['initialFinanceData'],
        queryFn: fetchInitialData,
        enabled: canViewPage,
    });
    const { empresas = [], contas = [], categorias = [], empreendimentos = [], allContacts = [], funcionarios = [] } = initialData || {};

    const { data: lancamentosData, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentos', { filters, currentPage, itemsPerPage, sortConfig }],
        queryFn: fetchLancamentos,
        enabled: canViewPage && activeTab === 'lancamentos',
    });
    const { data: lancamentos = [], count: totalCount = 0 } = lancamentosData || {};
    
    const { data: lancamentosFiltradosKpi = [] } = useQuery({
        queryKey: ['lancamentosKpi', { filters }],
        queryFn: fetchLancamentosKpi,
        enabled: canViewPage && activeTab === 'lancamentos',
    });

    const { data: todosLancamentosParaSaldos = [] } = useQuery({
        queryKey: ['saldosData', contas],
        queryFn: fetchTodosLancamentosParaSaldos,
        enabled: canViewPage && !!contas && contas.length > 0,
    });

    const deleteLancamentoMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success('Lançamento excluído com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] });
            queryClient.invalidateQueries({ queryKey: ['saldosData'] });
        },
        onError: (error) => {
            toast.error(`Erro ao excluir lançamento: ${error.message}`);
        }
    });

    const handleDeleteLancamento = (id) => {
        if (window.confirm("Tem certeza que deseja excluir este lançamento?")) {
            deleteLancamentoMutation.mutate(id);
        }
    };

    const handleSuccessForm = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
        queryClient.invalidateQueries({ queryKey: ['lancamentosKpi'] });
        queryClient.invalidateQueries({ queryKey: ['saldosData'] });
        queryClient.invalidateQueries({ queryKey: ['initialFinanceData'] });
    };

    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    
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
            
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel Financeiro</h1>
                <div className="flex items-center gap-2"> 
                    <Link href="/financeiro/categorias" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faSitemap} /> Categorias</Link>
                    <Link href="/financeiro/conciliacao" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faHandshake} /> Conciliação</Link>
                    <Link href="/financeiro/auditoria" title="Painel de Auditoria" className="text-gray-400 hover:text-orange-500"><FontAwesomeIcon icon={faShieldAlt} /></Link> 
                    <Link href="/financeiro/kpi-builder" className="bg-cyan-500 text-white px-4 py-2 rounded-md hover:bg-cyan-600 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faCalculator} /> KPIs</Link> 
                    <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faCogs} /> Assistente</Link> 
                    {canCreate && (<button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faPlus} /> Novo Lançamento</button>)}
                </div>
            </div>
            
            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="extrato" label="Extrato" icon={faFileInvoice} />
                    <TabButton tabName="lancamentos" label="Lançamentos" icon={faBalanceScale} />
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
                        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['lancamentos'] })}
                    />
                )}
                {activeTab === 'contas' && <ContasManager initialContas={contas} allLancamentos={todosLancamentosParaSaldos} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['initialFinanceData'] })} empresas={empresas} />}
                {activeTab === 'ativos' && <AtivosManager />}
            </div>
        </div>
    );
}