"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFilter, faTimes, faPenToSquare, faTrash, faSort, faSortUp, faSortDown, faTasks, faSave, faStar as faStarSolid, faEllipsisV,
    faChevronUp, faChevronDown, faArrowUp, faArrowDown, faBalanceScale, faCalendarDay, faCalendarWeek, faCalendarAlt, faLayerGroup, faSyncAlt,
    faChevronLeft, faChevronRight, faExclamationTriangle, faHourglassHalf
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import MultiSelectDropdown from './MultiSelectDropdown';
import KpiCard from '../KpiCard';

const SortableHeader = ({ label, sortKey, sortConfig, requestSort, className = '' }) => {
    const getIcon = () => {
        if (sortConfig.key !== sortKey) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };
    return (
        <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 hover:text-gray-900">
                <span className="uppercase">{label}</span>
                <FontAwesomeIcon icon={getIcon()} className="text-gray-400" />
            </button>
        </th>
    );
};

const BatchUpdateModal = ({ isOpen, onClose, onConfirm, fields, allData }) => {
    const [selectedField, setSelectedField] = useState('');
    const [selectedValue, setSelectedValue] = useState('');

    if (!isOpen) return null;

    const currentField = fields.find(f => f.key === selectedField);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">Alterar Campo em Lote</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">1. Campo para alterar</label>
                        <select value={selectedField} onChange={(e) => { setSelectedField(e.target.value); setSelectedValue(''); }} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione um campo...</option>
                            {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                    </div>
                    {selectedField && currentField && (
                        <div>
                            <label className="block text-sm font-medium">2. Novo valor para &quot;{currentField.label}&quot;</label>
                            {currentField.type === 'select' ? (
                                <select value={selectedValue} onChange={(e) => setSelectedValue(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                    <option value="">Selecione um valor...</option>
                                    {allData[currentField.optionsKey].map(opt => <option key={opt.id} value={opt.id}>{opt.nome || opt.razao_social || opt.nome_etapa}</option>)}
                                </select>
                            ) : (
                                <input type={currentField.type || 'text'} value={selectedValue} onChange={(e) => setSelectedValue(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={() => onConfirm(selectedField, selectedValue)} disabled={!selectedField || !selectedValue} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">Confirmar Alteração</button>
                </div>
            </div>
        </div>
    );
};

const initialFilterState = {
    searchTerm: '',
    empresaIds: [],
    contaIds: [],
    categoriaIds: [],
    empreendimentoIds: [],
    etapaIds: [],
    status: [],
    startDate: '',
    endDate: '',
    month: '',
    year: '',
};

export default function LancamentosManager({
    lancamentos: initialLancamentos,
    loading: initialLoading,
    empresas = [],
    contas = [],
    categorias = [],
    empreendimentos = [],
    onEdit,
    onDelete,
    onUpdate
}) {
    const supabase = createClient();
    const [lancamentos, setLancamentos] = useState(initialLancamentos);
    const [allLancamentosKpi, setAllLancamentosKpi] = useState([]);
    const [loading, setLoading] = useState(initialLoading);

    // Estados de Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [itemsPerPageInput, setItemsPerPageInput] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [editingCell, setEditingCell] = useState(null);
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [filters, setFilters] = useState(initialFilterState);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    const [isBatchActionsOpen, setIsBatchActionsOpen] = useState(false);
    const [isBatchUpdateModalOpen, setIsBatchUpdateModalOpen] = useState(false);
    const batchActionsRef = useRef(null);
    const [etapas, setEtapas] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'data_transacao', direction: 'descending' });
    const [allContatos, setAllContatos] = useState([]);

    const applyFiltersToQuery = useCallback((query, currentFilters) => {
        if (currentFilters.searchTerm) {
            query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
        }
        
        if (currentFilters.startDate) {
            query = query.or(`data_transacao.gte.${currentFilters.startDate},data_vencimento.gte.${currentFilters.startDate}`);
        }
        if (currentFilters.endDate) {
            query = query.or(`data_transacao.lte.${currentFilters.endDate},data_vencimento.lte.${currentFilters.endDate}`);
        }
        
        if (currentFilters.empresaIds.length > 0) {
            query = query.in('empresa_id', currentFilters.empresaIds);
        }
        if (currentFilters.contaIds.length > 0) {
            query = query.in('conta_id', currentFilters.contaIds);
        }
        if (currentFilters.categoriaIds.length > 0) {
            query = query.in('categoria_id', currentFilters.categoriaIds);
        }
        if (currentFilters.empreendimentoIds.length > 0) {
            query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
        }
        if (currentFilters.etapaIds.length > 0) {
            query = query.in('etapa_id', currentFilters.etapaIds);
        }

        if (currentFilters.status?.length > 0) {
            const hasAtrasada = currentFilters.status.includes('Atrasada');
            const otherStatus = currentFilters.status.filter(s => s !== 'Atrasada');
            const today = new Date().toISOString().split('T')[0];
    
            const orConditions = [];
            if (otherStatus.length > 0) {
                orConditions.push(`status.in.(${otherStatus.join(',')})`);
            }
            if (hasAtrasada) {
                orConditions.push(`and(status.eq.Pendente,data_vencimento.lt.${today})`);
            }
    
            if (orConditions.length > 0) {
                query = query.or(orConditions.join(','));
            }
        }
        return query;
    }, []);

    const fetchLancamentos = useCallback(async () => {
        setLoading(true);
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        let query = supabase
            .from('lancamentos')
            .select(`*, conta:conta_id(*, empresa:empresa_id(id, nome_fantasia, razao_social)), categoria:categoria_id(*), favorecido:favorecido_contato_id(*), empreendimento:empreendimento_id(*, empresa:empresa_proprietaria_id(id, nome_fantasia, razao_social)), anexos:lancamentos_anexos(*)`, { count: 'exact' })
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
    
    // ***** INÍCIO DA CORREÇÃO *****
    // Esta é a "busca clonada" que pega TODOS os dados para os KPIs, sem paginação.
    const fetchAllLancamentosForKpi = useCallback(async () => {
        let query = supabase.from('lancamentos').select('valor, tipo, status, data_pagamento, data_vencimento, conciliado');
        query = applyFiltersToQuery(query, filters);
        const { data, error } = await query;
        if (error) { console.error("Erro ao buscar dados para KPI:", error); }
        else { setAllLancamentosKpi(data || []); }
    }, [filters, supabase, applyFiltersToQuery]);
    
    // O cálculo dos KPIs agora usa a lista completa `allLancamentosKpi`.
    const kpiData = useMemo(() => {
        let receitasPagas = 0;
        let despesasPagas = 0;
        let aPagar = 0;
        let aReceber = 0;
        let atrasadas = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allLancamentosKpi.forEach(l => {
            const valor = l.valor || 0;
            // A condição para ser "pago" agora inclui o status e se está conciliado.
            const isRealizado = l.status === 'Pago' || l.conciliado === true;

            if (l.tipo === 'Receita') {
                if (isRealizado) {
                    receitasPagas += valor;
                } else {
                    aReceber += valor;
                }
            } else if (l.tipo === 'Despesa') {
                if (isRealizado) {
                    despesasPagas += valor;
                } else {
                    const vencimento = l.data_vencimento ? new Date(l.data_vencimento + 'T00:00:00Z') : null;
                    if (vencimento && vencimento < today) {
                        atrasadas += valor;
                    } else {
                        aPagar += valor;
                    }
                }
            }
        });

        const resultadoRealizado = receitasPagas - despesasPagas;

        return { 
            receitasPagas, 
            despesasPagas, 
            resultadoRealizado, 
            aPagar, 
            aReceber, 
            atrasadas 
        };
    }, [allLancamentosKpi]); // A dependência agora é a lista completa.
    
    // Agora as duas buscas são chamadas juntas quando os filtros mudam.
    useEffect(() => {
        fetchLancamentos();
        fetchAllLancamentosForKpi();
    }, [fetchLancamentos, fetchAllLancamentosForKpi]);
    // ***** FIM DA CORREÇÃO *****
    
    const handleItemsPerPageChange = () => {
        let value = Number(itemsPerPageInput);
        if (isNaN(value) || value < 1) value = 1;
        if (value > 999) value = 999;
        setItemsPerPageInput(value);
        setItemsPerPage(value);
        setCurrentPage(1);
    };

    useEffect(() => {
        setLancamentos(initialLancamentos);
        setLoading(initialLoading);
        setSelectedIds(new Set());
        const fetchContatos = async () => {
            const { data } = await supabase.from('contatos').select('id, nome, razao_social');
            setAllContatos(data || []);
        };
        fetchContatos();
    }, [initialLancamentos, initialLoading, supabase]);
    
    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]');
        setSavedFilters(loadedFilters);
        const fetchExtraData = async () => {
             const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
             setEtapas(etapasData || []);
        }
        fetchExtraData();
    }, [supabase]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) { setIsFilterMenuOpen(false); }
            if (batchActionsRef.current && !batchActionsRef.current.contains(event.target)) { setIsBatchActionsOpen(false); }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef, batchActionsRef]);

    const categoryTree = useMemo(() => {
        const tree = [];
        const map = {};
        const allCategories = JSON.parse(JSON.stringify(categorias));

        allCategories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; });
        allCategories.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) { map[cat.parent_id].children.push(map[cat.id]); }
            else { tree.push(map[cat.id]); }
        });
        return tree;
    }, [categorias]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({...prev, [name]: value}));
        if(name !== 'startDate' && name !== 'endDate') {
            setActivePeriodFilter('');
        }
        setCurrentPage(1);
    };
    
    useEffect(() => {
        const { month, year } = filters;
        if (month || year) {
             const newStartDate = year && month ? new Date(year, month - 1, 1).toISOString().split('T')[0] : (year ? `${year}-01-01` : '');
             const newEndDate = year && month ? new Date(year, month, 0).toISOString().split('T')[0] : (year ? `${year}-12-31` : '');
             setFilters(prev => ({...prev, startDate: newStartDate, endDate: newEndDate}));
        }
    }, [filters]);

    const setDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;

        if (period === 'today') { startDate = endDate = today; }
        else if (period === 'week') {
            const firstDayOfWeek = today.getDate() - today.getDay();
            startDate = new Date(today.setDate(firstDayOfWeek));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }

        setFilters(prev => ({ ...prev, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], month: '', year: '' }));
        setActivePeriodFilter(period);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters(initialFilterState);
        setActivePeriodFilter('');
        setCurrentPage(1);
    };

    const handleSaveFilter = () => {
        if (!newFilterName.trim()) { alert('Por favor, dê um nome para o filtro.'); return; }
        const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false;
        const updatedSavedFilters = savedFilters.filter(f => f.name !== newFilterName);
        const newSavedFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited };
        setSavedFilters([...updatedSavedFilters, newSavedFilter]);
        localStorage.setItem('savedFinancialFilters', JSON.stringify([...updatedSavedFilters, newSavedFilter]));
        setNewFilterName('');
        alert(`Filtro "${newFilterName}" salvo!`);
    };

    const handleUpdateFilter = (filterName) => {
        const updated = savedFilters.map(f => f.name === filterName ? { ...f, settings: filters } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedFinancialFilters', JSON.stringify(updated));
        alert(`Filtro "${filterName}" atualizado com sucesso!`);
    };

    const handleToggleFavorite = (filterName) => {
        const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedFinancialFilters', JSON.stringify(updated));
    };

    const handleLoadFilter = (filterSettings) => {
        setFilters({ ...initialFilterState, ...filterSettings });
        setIsFilterMenuOpen(false);
        setActivePeriodFilter('');
        setCurrentPage(1);
    };

    const handleDeleteFilter = (filterNameToDelete) => {
        if (!window.confirm(`Tem certeza que deseja excluir o filtro "${filterNameToDelete}"?`)) return;
        const updatedSavedFilters = savedFilters.filter(f => f.name !== filterNameToDelete);
        setSavedFilters(updatedSavedFilters);
        localStorage.setItem('savedFinancialFilters', JSON.stringify(updatedSavedFilters));
    };
    
    const requestSort = (key) => {
        let direction = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') direction = 'ascending';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(lancamentos.map(l => l.id)));
        else setSelectedIds(new Set());
    };
    
    const handleSelectOne = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedIds(newSelection);
    };

    const handleBulkUpdate = async (updateObject) => {
        if (!window.confirm(`Tem certeza que deseja aplicar esta alteração a ${selectedIds.size} lançamento(s)?`)) return;
        const { error } = await supabase.from('lancamentos').update(updateObject).in('id', Array.from(selectedIds));
        if (error) { alert("Erro ao atualizar: " + error.message); }
        else { alert('Lançamentos atualizados com sucesso!'); if (onUpdate) onUpdate(); }
    };

    const handleBatchUpdateField = (field, value) => {
        setIsBatchUpdateModalOpen(false);
        if(!field || !value) { alert("Por favor, selecione um campo e um valor."); return; }
        const updateObject = { [field]: value };
        if(field === 'status' && value === 'Pago'){
            updateObject.data_pagamento = new Date().toISOString();
        }
        handleBulkUpdate(updateObject);
    };

    const batchUpdateFields = [
        { key: 'status', label: 'Status', type: 'select', optionsKey: 'statusOptions' },
        { key: 'categoria_id', label: 'Categoria', type: 'select', optionsKey: 'categorias' },
        { key: 'empreendimento_id', label: 'Empreendimento', type: 'select', optionsKey: 'empreendimentos' },
        { key: 'conta_id', label: 'Conta', type: 'select', optionsKey: 'contas' },
        { key: 'etapa_id', label: 'Etapa da Obra', type: 'select', optionsKey: 'etapas' },
        { key: 'data_vencimento', label: 'Data de Vencimento', type: 'date' },
    ];

    const allDataForBatchModal = {
        statusOptions: [{id: 'Pago', nome: 'Pago'}, {id: 'Pendente', nome: 'Pendente'}],
        categorias, empreendimentos, contas, etapas,
    };
    
    const getPaymentStatus = (item) => {
        if (item.status === 'Pago' || item.conciliado) return { text: 'Paga', className: 'bg-green-100 text-green-800' };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(item.data_vencimento || item.data_transacao);
        if (dueDate < today) return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
        return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
    };
    
    const formatCurrency = (value, tipo) => {
        const signal = tipo === 'Receita' ? '+' : (tipo === 'Despesa' ? '-' : '');
        return `${signal} ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value || 0))}`;
    };
    
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    const statusOptions = [
        { id: 'Pago', text: 'Paga' }, { id: 'Pendente', text: 'A Pagar' }, { id: 'Atrasada', text: 'Atrasada' }
    ].map(s => ({...s, nome: s.text}));

    const months = [
        {id: "01", nome: "Janeiro"}, {id: "02", nome: "Fevereiro"}, {id: "03", nome: "Março"},
        {id: "04", nome: "Abril"}, {id: "05", nome: "Maio"}, {id: "06", nome: "Junho"},
        {id: "07", nome: "Julho"}, {id: "08", nome: "Agosto"}, {id: "09", nome: "Setembro"},
        {id: "10", nome: "Outubro"}, {id: "11", nome: "Novembro"}, {id: "12", nome: "Dezembro"}
    ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => ({ id: (currentYear - 5 + i).toString(), nome: (currentYear - 5 + i).toString() }));

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return (
        <div className="space-y-4">
            <BatchUpdateModal isOpen={isBatchUpdateModalOpen} onClose={() => setIsBatchUpdateModalOpen(false)} onConfirm={handleBatchUpdateField} fields={batchUpdateFields} allData={allDataForBatchModal} />

             <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex justify-between items-center">
                    <button onClick={() => setFiltersVisible(!filtersVisible)} className="font-semibold text-lg flex items-center gap-2 uppercase">
                        <FontAwesomeIcon icon={faFilter} /> Filtros <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
                    </button>
                    <div className="relative" ref={filterMenuRef}>
                        <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="p-2 border rounded-md bg-white hover:bg-gray-100">
                            <FontAwesomeIcon icon={faEllipsisV} />
                        </button>
                        {isFilterMenuOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border">
                                <div className="p-3 border-b">
                                    <p className="font-semibold text-sm mb-2">Salvar Filtro Atual</p>
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-2 border rounded-md text-sm w-full"/>
                                        <button onClick={handleSaveFilter} className="text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-2 rounded-md"><FontAwesomeIcon icon={faSave}/></button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="font-semibold text-sm mb-2">Filtros Salvos</p>
                                    <ul className="max-h-40 overflow-y-auto">
                                        {savedFilters.length > 0 ? savedFilters.map((f, i) => (
                                            <li key={i} className="flex justify-between items-center text-sm py-1 group">
                                                <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer hover:underline">{f.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdateFilter(f.name)} title="Atualizar Filtro" className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"> <FontAwesomeIcon icon={faSyncAlt}/> </button>
                                                    <button onClick={() => handleToggleFavorite(f.name)} title="Favoritar" className="text-gray-400 hover:text-yellow-500"> <FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} className={f.isFavorite ? 'text-yellow-500' : ''}/> </button>
                                                    <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"> <FontAwesomeIcon icon={faTrash}/> </button>
                                                </div>
                                            </li>
                                        )) : <li className="text-xs text-gray-500">Nenhum filtro salvo.</li>}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                 
                {filtersVisible && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 gap-4"><input type="text" name="searchTerm" placeholder="BUSCAR POR DESCRIÇÃO OU FAVORECIDO..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div><MultiSelectDropdown label="Empresas" options={empresas} selectedIds={filters.empresaIds} onChange={(selected) => handleFilterChange('empresaIds', selected)} /></div>
                            <div><MultiSelectDropdown label="Empreendimentos" options={empreendimentos} selectedIds={filters.empreendimentoIds} onChange={(selected) => handleFilterChange('empreendimentoIds', selected)} /></div>
                            <div><MultiSelectDropdown label="Contas" options={contas} selectedIds={filters.contaIds} onChange={(selected) => handleFilterChange('contaIds', selected)} /></div>
                            <div><MultiSelectDropdown label="Categorias" options={categoryTree} selectedIds={filters.categoriaIds} onChange={(selected) => handleFilterChange('categoriaIds', selected)} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                             <div><MultiSelectDropdown label="Etapa da Obra" options={etapas.map(e => ({...e, nome: e.nome_etapa}))} selectedIds={filters.etapaIds} onChange={(selected) => handleFilterChange('etapaIds', selected)} /></div>
                             <div><MultiSelectDropdown label="Status" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos os Status" /></div>
                            <div className="lg:col-span-2 flex items-end gap-2">
                                <div className="flex-1"><label className="text-xs uppercase font-medium text-gray-600">Mês</label><select name="month" value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"><option value="">Todos</option>{months.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                <div className="w-28"><label className="text-xs uppercase font-medium text-gray-600">Ano</label><select name="year" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"><option value="">Todos</option>{years.map(y => <option key={y.id} value={y.id}>{y.nome}</option>)}</select></div>
                                <div><label className="text-xs uppercase">De:</label><input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                                <div><label className="text-xs uppercase">Até:</label><input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
                            <div className="flex items-center gap-2"><button onClick={() => setDateRange('today')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button><button onClick={() => setDateRange('week')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button><button onClick={() => setDateRange('month')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button></div>
                            <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faTimes} />Limpar Filtros</button>
                        </div>
                    </div>
                )}
            </div>

            {savedFilters.filter(f => f.isFavorite).length > 0 && (
                <div className="p-4 border rounded-lg bg-white space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm uppercase text-gray-600"><FontAwesomeIcon icon={faStarSolid} /> Filtros Favoritos</h4>
                    <div className="flex flex-wrap gap-2">
                        {savedFilters.filter(f => f.isFavorite).map((f, i) => {
                            const isActive = JSON.stringify(filters) === JSON.stringify(f.settings);
                            return (
                                <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                                    {f.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard title="Receitas Realizadas" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.receitasPagas)} icon={faArrowUp} color="green" />
                <KpiCard title="Despesas Realizadas" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.despesasPagas)} icon={faArrowDown} color="red" />
                <KpiCard title="Resultado do Período" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.resultadoRealizado)} icon={faBalanceScale} color={kpiData.resultadoRealizado >= 0 ? 'blue' : 'gray'} />
                
                <KpiCard title="Contas a Pagar" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.aPagar)} icon={faHourglassHalf} color="yellow" />
                <KpiCard title="Contas a Receber" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.aReceber)} icon={faHourglassHalf} color="blue" />
                <KpiCard title="Contas Atrasadas" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.atrasadas)} icon={faExclamationTriangle} color="red" />
            </div>
            
            <div className="flex justify-between items-center bg-white p-4 border rounded-lg shadow-sm">
                <span className="text-sm text-gray-700">
                    Mostrando <strong>{lancamentos.length}</strong> de <strong>{totalCount}</strong> lançamentos
                </span>
                <div className="flex items-center gap-2">
                    <label htmlFor="items-per-page" className="text-sm font-medium">Itens por página:</label>
                    <input
                        type="number"
                        id="items-per-page"
                        value={itemsPerPageInput}
                        onChange={(e) => setItemsPerPageInput(e.target.value)}
                        onBlur={handleItemsPerPageChange}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                        min="1"
                        max="999"
                        className="w-20 p-2 border rounded-md text-center"
                    />
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading} className="p-2 border rounded-md disabled:opacity-50">
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span className="px-4 py-2 text-sm">Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading} className="p-2 border rounded-md disabled:opacity-50">
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
            </div>

            {selectedIds.size > 0 && (
                 <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                    <span className="text-sm font-semibold text-blue-800 uppercase">{selectedIds.size} selecionado(s)</span>
                    <div className="relative" ref={batchActionsRef}>
                        <button onClick={() => setIsBatchActionsOpen(prev => !prev)} className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm font-bold hover:bg-blue-700 uppercase flex items-center gap-2">
                            <FontAwesomeIcon icon={faLayerGroup} /> Ações em Lote <FontAwesomeIcon icon={faChevronDown} className="text-xs"/>
                        </button>
                        {isBatchActionsOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border">
                                <a onClick={() => { setIsBatchUpdateModalOpen(true); setIsBatchActionsOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Alterar Campo...</a>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {loading ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : (
                 <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 w-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === lancamentos.length} /></th>
                                <SortableHeader label="Transação" sortKey="data_transacao" sortConfig={sortConfig} requestSort={requestSort} />
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase w-1/4">Descrição</th>
                                <SortableHeader label="Favorecido" sortKey="favorecido" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader label="Categoria" sortKey="categoria" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader label="Empresa" sortKey="empresa" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader label="Empreendimento" sortKey="empreendimento" sortConfig={sortConfig} requestSort={requestSort} />
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lancamentos.length > 0 ? lancamentos.map(item => {
                                const statusInfo = getPaymentStatus(item);
                                const isEditing = editingCell?.id === item.id;
                                const nomeEmpresa = item.empreendimento?.empresa?.nome_fantasia || item.empreendimento?.empresa?.razao_social || item.conta?.empresa?.nome_fantasia || item.conta?.empresa?.razao_social || 'N/A';

                                return (
                                    <tr key={item.id} className={`${selectedIds.has(item.id) ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectOne(item.id)} /></td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'data_transacao' })}>{isEditing && editingCell.field === 'data_transacao' ? <input type="date" defaultValue={item.data_transacao} autoFocus onBlur={(e) => {}} className="p-1 border rounded bg-yellow-50"/> : formatDate(item.data_transacao)}</td>
                                        <td className="px-4 py-2 font-medium" onClick={() => setEditingCell({ id: item.id, field: 'descricao' })}>{isEditing && editingCell.field === 'descricao' ? <input defaultValue={item.descricao} autoFocus onBlur={(e) => {}} className="w-full p-1 border rounded bg-yellow-50"/> : <span>{item.descricao}</span>}</td>
                                        <td className="px-4 py-2">{item.favorecido?.nome || item.favorecido?.razao_social || 'N/A'}</td>
                                        <td className="px-4 py-2">{item.categoria?.nome || 'N/A'}</td>
                                        <td className="px-4 py-2"><span className="uppercase">{nomeEmpresa}</span></td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'empreendimento_id' })}>{isEditing && editingCell.field === 'empreendimento_id' ? <select defaultValue={item.empreendimento_id || ''} autoFocus onBlur={(e) => {}} className="w-full p-1 border rounded bg-yellow-50"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select> : <span>{item.empreendimento?.nome || 'N/A'}</span>}</td>
                                        <td className={`px-4 py-2 text-right font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`} onClick={() => setEditingCell({ id: item.id, field: 'valor' })}>{isEditing && editingCell.field === 'valor' ? <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} defaultValue={String(item.valor || '')} autoFocus onAccept={(v) => {}} className="w-full p-1 border rounded bg-yellow-50 text-right"/> : formatCurrency(item.valor, item.tipo)}</td>
                                        <td className="px-4 py-2 text-center text-xs"><span className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className}`}>{statusInfo.text.toUpperCase()}</span></td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => onEdit(item)} className="text-blue-500 hover:text-blue-700 mr-3" title="Editar Completo"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                            <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="10" className="text-center py-10 text-gray-500 uppercase">Nenhum lançamento encontrado. Tente limpar os filtros.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}