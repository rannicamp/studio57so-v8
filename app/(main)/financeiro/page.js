"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs, faShieldAlt, faProjectDiagram, faChartPie } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import KpiCard from '../../../components/KpiCard';

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('lancamentos');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const [empresas, setEmpresas] = useState([]);
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [lancamentos, setLancamentos] = useState([]);
    const [allLancamentosKpi, setAllLancamentosKpi] = useState([]);
    
    const [kpis, setKpis] = useState([]);
    const [kpiResults, setKpiResults] = useState([]);
    const [loadingKpis, setLoadingKpis] = useState(true);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [filters, setFilters] = useState({
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
        etapaIds: [], status: [], startDate: '', endDate: '', month: '', year: '', tipo: []
    });

    const [sortConfig, setSortConfig] = useState({ key: 'data_transacao', direction: 'descending' });
    
    // ***** INÍCIO DA CORREÇÃO *****
    // A função de cálculo agora chama a nova RPC que espera a fórmula como texto
    const fetchAndCalculateKpis = useCallback(async () => {
        setLoadingKpis(true);
        const { data: kpisData, error: kpisError } = await supabase.from('kpis_financeiros').select('*');

        if (kpisError) {
            console.error("Erro ao buscar KPIs:", kpisError);
            setKpis([]);
            setKpiResults([]);
            setLoadingKpis(false);
            return;
        }

        setKpis(kpisData || []);

        const results = await Promise.all(
            (kpisData || []).map(async (kpi) => {
                // Passa a fórmula diretamente para a função RPC
                const { data: result, error } = await supabase.rpc('calcular_valor_kpi', { p_formula: kpi.formula });
                if (error) {
                    console.error(`Erro ao calcular KPI "${kpi.nome_kpi}":`, error);
                    return { ...kpi, valor: 'Erro' };
                }
                return { ...kpi, valor: result };
            })
        );
        
        setKpiResults(results);
        setLoadingKpis(false);
    }, [supabase]);
    // ***** FIM DA CORREÇÃO *****

    useEffect(() => {
        fetchAndCalculateKpis();
    }, [fetchAndCalculateKpis]);

    const applyFiltersToQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
        if (currentFilters.startDate) query = query.or(`data_transacao.gte.${currentFilters.startDate},data_vencimento.gte.${currentFilters.startDate}`);
        if (currentFilters.endDate) query = query.or(`data_transacao.lte.${currentFilters.endDate},data_vencimento.lte.${currentFilters.endDate}`);
        if (currentFilters.empresaIds.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
        if (currentFilters.contaIds.length > 0) query = query.in('conta_id', currentFilters.contaIds);
        if (currentFilters.categoriaIds.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
        if (currentFilters.empreendimentoIds.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
        if (currentFilters.etapaIds.length > 0) query = query.in('etapa_id', currentFilters.etapaIds);
        if (currentFilters.tipo.length > 0) {
            query = query.in('tipo', currentFilters.tipo);
        }
        if (currentFilters.status?.length > 0) {
            const hasAtrasada = currentFilters.status.includes('Atrasada');
            const otherStatus = currentFilters.status.filter(s => s !== 'Atrasada');
            const today = new Date().toISOString().split('T')[0];
            const orConditions = [];
            if (otherStatus.length > 0) orConditions.push(`status.in.(${otherStatus.join(',')})`);
            if (hasAtrasada) orConditions.push(`and(status.eq.Pendente,data_vencimento.lt.${today})`);
            if (orConditions.length > 0) query = query.or(orConditions.join(','));
        }
        return query;
    }, []);

    const fetchLancamentos = useCallback(async () => {
        setLoading(true);
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        let query = supabase
            .from('lancamentos')
            .select(`*, conta:conta_id(*, empresa:empresa_id(id, nome_fantasia, razao_social)), categoria:categoria_id(*), favorecido:favorecido_contato_id(*), empreendimento:empreendimentos(*, empresa:empresa_proprietaria_id(id, nome_fantasia, razao_social)), anexos:lancamentos_anexos(*)`, { count: 'exact' })
            .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' })
            .range(from, to);
        query = applyFiltersToQuery(query, filters);
        const { data, error, count } = await query;
        if (error) { console.error("Erro ao buscar lançamentos:", error); } 
        else {
            setLancamentos(data || []);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [currentPage, itemsPerPage, sortConfig, filters, supabase, applyFiltersToQuery]);

    const fetchAllLancamentosForKpi = useCallback(async () => {
        let query = supabase.from('lancamentos').select('valor, tipo, status, data_pagamento, data_vencimento, conciliado');
        query = applyFiltersToQuery(query, filters);
        const { data, error } = await query;
        if (error) { console.error("Erro ao buscar dados para KPI:", error); } 
        else { setAllLancamentosKpi(data || []); }
    }, [filters, supabase, applyFiltersToQuery]);

    const fetchInitialData = useCallback(async () => {
        const [empresasRes, contasRes, categoriasRes, empreendimentosRes] = await Promise.all([
            supabase.from('cadastro_empresa').select('*').order('nome_fantasia'),
            supabase.from('contas_financeiras').select('*, empresa:empresa_id(*)').order('nome'),
            supabase.from('categorias_financeiras').select('*').order('nome'),
            supabase.from('empreendimentos').select('*, empresa:empresa_proprietaria_id(nome_fantasia, razao_social)').order('nome')
        ]);
        setEmpresas(empresasRes.data || []);
        setContas(contasRes.data || []);
        setCategorias(categoriasRes.data || []);
        setEmpreendimentos(empreendimentosRes.data || []);
    }, [supabase]);
    
    useEffect(() => {
        setPageTitle('GESTÃO FINANCEIRA');
        fetchInitialData();
    }, [setPageTitle, fetchInitialData]);
    
    useEffect(() => {
        fetchLancamentos();
        fetchAllLancamentosForKpi();
    }, [fetchLancamentos, fetchAllLancamentosForKpi, filters]);
    
    const handleSaveLancamento = async (formData) => {
        const isEditing = Boolean(formData.id); const { anexo, novo_favorecido, ...baseFormData } = formData;
        let finalFormData = { ...baseFormData };
        if (novo_favorecido && novo_favorecido.nome) {
            const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: novo_favorecido.nome, tipo_contato: 'Fornecedor' }).select().single();
            if (contatoError) {setMessage(`Erro ao criar novo favorecido: ${contatoError.message}`); return false;}
            finalFormData.favorecido_contato_id = novoContato.id;
        }
        let lancamentoId = finalFormData.id; let error;
        if (isEditing) {
            const { id, ...dataToUpdate } = finalFormData;
            const { error: updateError } = await supabase.from('lancamentos').update(dataToUpdate).eq('id', id);
            error = updateError;
        } else {
            delete finalFormData.id;
            const { data: newLancamento, error: insertError } = await supabase.from('lancamentos').insert(finalFormData).select().single();
            error = insertError; if (newLancamento) lancamentoId = newLancamento.id;
        }
        if (error) {setMessage(`Erro ao salvar lançamento: ${error.message}`); return false;}
        if (anexo && anexo.file && lancamentoId) {
            const file = anexo.file;
            const filePath = `lancamento-${lancamentoId}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
            if (uploadError) {setMessage(`Lançamento salvo, mas falha ao enviar anexo: ${uploadError.message}`);}
            else {
                const { error: anexoError } = await supabase.from('lancamentos_anexos').insert({ lancamento_id: lancamentoId, caminho_arquivo: filePath, nome_arquivo: file.name, descricao: anexo.descricao, tipo_documento_id: anexo.tipo_documento_id });
                if (anexoError) setMessage(`Lançamento salvo, mas falha ao registrar anexo: ${anexoError.message}`);
            }
        }
        setMessage(`Lançamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
        fetchLancamentos(); fetchAllLancamentosForKpi(); fetchAndCalculateKpis(); return true;
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

    const formatKpiValue = (kpi) => {
        const { valor, formato_exibicao } = kpi;
        if (typeof valor !== 'number') return valor;
    
        switch (formato_exibicao) {
            case 'moeda':
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
            case 'porcentagem':
                return `${valor.toFixed(2)}%`;
            default:
                return valor.toLocaleString('pt-BR');
        }
    };


    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSave={handleSaveLancamento} initialData={editingLancamento} empresas={empresas} />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel Financeiro</h1>
                {activeTab === 'lancamentos' && (
                    <div className="flex items-center gap-2">
                         <Link href="/financeiro/auditoria" title="Painel de Auditoria" className="text-gray-400 hover:text-orange-500"><FontAwesomeIcon icon={faShieldAlt} /></Link>
                         <Link href="/financeiro/kpi-builder" title="Construtor de KPIs" className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faProjectDiagram} /> KPIs</Link>
                         <Link href="/financeiro/transferencias" className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2 uppercase">Identificar Transferências</Link>
                         <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faCogs} /> Assistente</Link>
                         <button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faPlus} /> Novo Lançamento</button>
                    </div>
                )}
            </div>

            {activeTab === 'lancamentos' && kpis.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {loadingKpis ? (
                        <p>Calculando KPIs...</p>
                    ) : (
                        kpiResults.map(kpi => (
                            <KpiCard
                                key={kpi.id}
                                title={kpi.nome_kpi}
                                value={formatKpiValue(kpi)}
                                icon={faChartPie}
                                color="purple"
                            />
                        ))
                    )}
                </div>
            )}

            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="lancamentos" label="Lançamentos" />
                    <TabButton tabName="conciliacao" label="Conciliação Bancária" />
                    <TabButton tabName="contas" label="Contas" />
                    <TabButton tabName="categorias" label="Categorias" />
                </nav>
            </div>
            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm uppercase">{message}</p>}
            <div className="mt-4">
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos} allLancamentosKpi={allLancamentosKpi} loading={loading}
                        contas={contas} categorias={categorias} empreendimentos={empreendimentos} empresas={empresas}
                        filters={filters} setFilters={setFilters} sortConfig={sortConfig} setSortConfig={setSortConfig}
                        currentPage={currentPage} setCurrentPage={setCurrentPage} itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage}
                        totalCount={totalCount} onEdit={handleOpenEditModal} onDelete={handleDeleteLancamento} onUpdate={fetchLancamentos}
                    />
                )}
                {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} />}
                {activeTab === 'contas' && <ContasManager initialContas={contas} allLancamentos={lancamentos} onUpdate={fetchInitialData} />}
                {activeTab === 'categorias' && <CategoriasManager />}
            </div>
        </div>
    );
}