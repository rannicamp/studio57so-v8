"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import KpiCard from '../../../components/KpiCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs, faShieldAlt, faCalculator, faSpinner, faLock, faArrowDown, faArrowUp, faBalanceScale, faSitemap, faHandshake } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento } = useEmpreendimento();
    const supabase = createClient();
    const router = useRouter();
    const { hasPermission, loading: authLoading } = useAuth();

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
    const [lancamentosFiltradosKpi, setLancamentosFiltradosKpi] = useState([]);
    const [todosLancamentosParaSaldos, setTodosLancamentosParaSaldos] = useState([]);
    const [allContacts, setAllContacts] = useState([]);
    const [funcionarios, setFuncionarios] = useState([]);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState({ searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [], etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', });
    const [sortConfig, setSortConfig] = useState({ key: 'data_transacao', direction: 'descending' });
    
    useEffect(() => { if (!authLoading && !canViewPage) { router.push('/'); } }, [authLoading, canViewPage, router]);

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
        }
    }, [filters]);

    const applyFiltersToQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
        
        if (currentFilters.startDate && currentFilters.endDate) {
            const transacaoInRange = `and(data_transacao.gte.${currentFilters.startDate},data_transacao.lte.${currentFilters.endDate})`;
            const vencimentoInRange = `and(data_vencimento.gte.${currentFilters.startDate},data_vencimento.lte.${currentFilters.endDate})`;
            query = query.or(`${transacaoInRange},${vencimentoInRange}`);
        } else if (currentFilters.startDate) {
            query = query.or(`data_transacao.gte.${currentFilters.startDate},data_vencimento.gte.${currentFilters.startDate}`);
        } else if (currentFilters.endDate) {
            query = query.or(`data_transacao.lte.${currentFilters.endDate},data_vencimento.lte.${currentFilters.endDate}`);
        }

        if (currentFilters.empresaIds?.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
        if (currentFilters.contaIds?.length > 0) { query = query.or(`conta_id.in.(${currentFilters.contaIds.join(',')}),conta_destino_id.in.(${currentFilters.contaIds.join(',')})`); }
        if (currentFilters.categoriaIds?.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
        if (currentFilters.empreendimentoIds?.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
        if (currentFilters.etapaIds?.length > 0) query = query.in('etapa_id', currentFilters.etapaIds);
        
        if (currentFilters.status?.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const orConditions = [];
            
            const hasPago = currentFilters.status.includes('Pago');
            const hasPendente = currentFilters.status.includes('Pendente');
            const hasAtrasada = currentFilters.status.includes('Atrasada');
            const hasAReceber = currentFilters.status.includes('A Receber');
            const otherStatus = currentFilters.status.filter(s => !['Pago', 'Pendente', 'Atrasada', 'A Receber'].includes(s));
            
            if(otherStatus.length > 0) {
                 orConditions.push(`status.in.(${otherStatus.join(',')})`);
            }
            if(hasPago) orConditions.push(`status.eq.Pago`);
            if (hasPendente) {
                orConditions.push(`and(status.eq.Pendente,tipo.eq.Despesa,data_vencimento.gte.${today})`);
            }
            if (hasAtrasada) {
                orConditions.push(`and(status.eq.Pendente,data_vencimento.lt.${today})`);
            }
            if (hasAReceber) {
                orConditions.push(`and(tipo.eq.Receita,status.eq.Pendente,data_vencimento.gte.${today})`);
            }
            
            if (orConditions.length > 0) {
                query = query.or(orConditions.join(','));
            }
        }

        if (currentFilters.tipo?.length > 0) { query = query.in('tipo', currentFilters.tipo); }
        return query;
    }, []);

    const fetchLancamentos = useCallback(async () => {
        setLoading(true);
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        const selectString = `*, data_pagamento, conta:contas_financeiras!conta_id(*, empresa:cadastro_empresa!empresa_id(id, nome_fantasia, razao_social)), conta_destino:contas_financeiras!conta_destino_id(id, nome), categoria:categorias_financeiras(*), favorecido:contatos!favorecido_contato_id(*), empreendimento:empreendimentos(*, empresa:cadastro_empresa!empresa_proprietaria_id(id, nome_fantasia, razao_social)), anexos:lancamentos_anexos(*)`;
        let query = supabase.from('lancamentos').select(selectString, { count: 'exact' }).order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' }).range(from, to);
        query = applyFiltersToQuery(query, filters);
        const { data, error, count } = await query;
        if (error) { console.error("Erro ao buscar lançamentos:", error); setMessage(`Falha ao carregar dados: ${error.message}`);
        } else { setLancamentos(data || []); setTotalCount(count || 0); }
        setLoading(false);
    }, [currentPage, itemsPerPage, sortConfig, filters, supabase, applyFiltersToQuery]);
    
    const fetchLancamentosFiltradosParaKpi = useCallback(async () => {
        let query = supabase.from('lancamentos').select('valor, tipo');
        query = applyFiltersToQuery(query, filters);
        const { data, error } = await query;
        if (error) { console.error("Erro ao buscar dados para KPI:", error); } 
        else { setLancamentosFiltradosKpi(data || []); }
    }, [filters, supabase, applyFiltersToQuery]);
    
    const fetchTodosLancamentosParaSaldos = useCallback(async (listaDeContas) => {
        if (!listaDeContas || listaDeContas.length === 0) {
            setTodosLancamentosParaSaldos([]);
            return;
        }
        const empresaIds = [...new Set(listaDeContas.map(c => c.empresa_id).filter(Boolean))];
        let query = supabase
            .from('lancamentos')
            .select('valor, tipo, status, conciliado, conta_id, conta_destino_id')
            .or('status.eq.Pago,conciliado.eq.true');
            
        if (empresaIds.length > 0) {
            query = query.in('empresa_id', empresaIds);
        }

        const { data, error } = await query;
        if (error) { console.error("Erro ao buscar dados para Saldos:", error); }
        else { setTodosLancamentosParaSaldos(data || []); }
    }, [supabase]);

    const fetchInitialData = useCallback(async () => {
        const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes, funcionariosRes] = await Promise.all([
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
        await fetchTodosLancamentosParaSaldos(contasRes.data || []);
    }, [supabase, fetchTodosLancamentosParaSaldos]);
    
    useEffect(() => {
        if (!authLoading && canViewPage) { setPageTitle('GESTÃO FINANCEIRA'); fetchInitialData(); }
    }, [setPageTitle, fetchInitialData, authLoading, canViewPage]);
    
    useEffect(() => { if (canViewPage) { fetchLancamentos(); fetchLancamentosFiltradosParaKpi(); } }, [fetchLancamentos, fetchLancamentosFiltradosParaKpi, canViewPage]);
    
    const handleSuccess = () => { fetchLancamentos(); fetchLancamentosFiltradosParaKpi(); fetchInitialData(); };
    const handleDeleteLancamento = async (id) => { if (!window.confirm("Tem certeza?")) return; const { error } = await supabase.from('lancamentos').delete().eq('id', id); if(error) {setMessage('Erro: ' + error.message);} else { setMessage('Lançamento excluído.'); handleSuccess(); }};
    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };
    const TabButton = ({ tabName, label }) => ( <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}> {label} </button> );

    if (authLoading) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>; }
    if (!canViewPage) { return ( <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg"> <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" /> <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2> <p className="mt-2 text-red-600">Você não tem permissão para aceder a esta página.</p> </div> ); }

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={handleSuccess} initialData={editingLancamento} empresas={empresas} />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel Financeiro</h1>
                <div className="flex items-center gap-2"> 
                    <Link href="/financeiro/categorias" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faSitemap} /> Categorias</Link>
                    <Link href="/financeiro/conciliacao" className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faHandshake} /> Conciliação</Link>
                    <Link href="/financeiro/auditoria" title="Painel de Auditoria" className="text-gray-400 hover:text-orange-500"><FontAwesomeIcon icon={faShieldAlt} /></Link> 
                    <Link href="/financeiro/transferencias" className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2 uppercase text-xs">Identificar Transferências</Link> 
                    <Link href="/financeiro/kpi-builder" className="bg-cyan-500 text-white px-4 py-2 rounded-md hover:bg-cyan-600 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faCalculator} /> KPIs</Link> 
                    <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faCogs} /> Assistente</Link> 
                    {canCreate && (<button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 uppercase text-xs"><FontAwesomeIcon icon={faPlus} /> Novo Lançamento</button>)}
                </div>
            </div>
            
            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="lancamentos" label="Lançamentos" />
                    <TabButton tabName="contas" label="Contas" />
                </nav>
            </div>

            {message && <p className={`text-center p-2 rounded-md text-sm uppercase font-semibold ${message.includes('ERRO') || message.includes('Falha') ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}
            
            <div className="mt-4">
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos}
                        allLancamentosKpi={lancamentosFiltradosKpi}
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
                {activeTab === 'contas' && <ContasManager initialContas={contas} allLancamentos={todosLancamentosParaSaldos} onUpdate={fetchInitialData} empresas={empresas} />}
            </div>
        </div>
    );
}