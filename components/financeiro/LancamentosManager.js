"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFilter, faTimes, faPenToSquare, faTrash, faSort, faSortUp, faSortDown, faTasks, faSave, faStar as faStarSolid, faEllipsisV
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import MultiSelectDropdown from './MultiSelectDropdown';

// Componente do Cabeçalho da Tabela
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

// Componente Principal
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
    const [loading, setLoading] = useState(initialLoading);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [editingCell, setEditingCell] = useState(null);

    const [filters, setFilters] = useState({
        searchTerm: '',
        empresaIds: [],
        contaIds: [],
        categoriaIds: [],
        empreendimentoIds: [],
        status: [],
        startDate: '',
        endDate: '',
        month: '',
        year: new Date().getFullYear().toString(),
    });

    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);

    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]');
        setSavedFilters(loadedFilters);
    }, []);

    const [sortConfig, setSortConfig] = useState({ key: 'data_transacao', direction: 'descending' });
    const [allContatos, setAllContatos] = useState([]);

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
        function handleClickOutside(event) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
                setIsFilterMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef]);

    const categoryTree = useMemo(() => {
        const tree = [];
        const map = {};
        const allCategories = JSON.parse(JSON.stringify(categorias));

        allCategories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; });
        allCategories.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) {
                map[cat.parent_id].children.push(map[cat.id]);
            } else {
                tree.push(map[cat.id]);
            }
        });
        return tree;
    }, [categorias]);

    const handleFilterChange = (name, value) => {
        const newFilters = { ...filters, [name]: value };

        if (name === "month" || name === "year") {
            const year = name === "year" ? value : newFilters.year;
            const month = name === "month" ? value : newFilters.month;

            if (year && month) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0);
                newFilters.startDate = startDate.toISOString().split('T')[0];
                newFilters.endDate = endDate.toISOString().split('T')[0];
            } else if (year && !month) {
                newFilters.startDate = `${year}-01-01`;
                newFilters.endDate = `${year}-12-31`;
            }
        }
        setFilters(newFilters);
    };

    const clearFilters = () => {
        setFilters({ searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [], status: [], startDate: '', endDate: '', month: '', year: new Date().getFullYear().toString() });
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

    const handleToggleFavorite = (filterName) => {
        const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedFinancialFilters', JSON.stringify(updated));
    };

    const handleLoadFilter = (filterSettings) => {
        setFilters(filterSettings);
        setIsFilterMenuOpen(false);
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
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(filteredAndSortedLancamentos.map(l => l.id)));
        else setSelectedIds(new Set());
    };
    
    const handleSelectOne = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedIds(newSelection);
    };

    const handleBulkMarkAsPaid = async () => {
        if (!window.confirm(`Tem certeza que deseja marcar ${selectedIds.size} lançamento(s) como pago(s)?`)) return;
        const { error } = await supabase
            .from('lancamentos').update({ status: 'Pago', data_pagamento: new Date().toISOString() })
            .in('id', Array.from(selectedIds));
        if (error) alert("Erro ao atualizar: " + error.message);
        else if (onUpdate) onUpdate();
    };

    const handleInlineUpdate = async (itemId, field, value) => {
        setEditingCell(null);
        const originalItem = lancamentos.find(l => l.id === itemId);
        let finalValue = value;
        
        if (field === 'valor') finalValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        if (String(originalItem[field]) === String(finalValue)) return;
        
        const updateObject = { [field]: finalValue };

        if (field === 'empreendimento_id') {
            const empreendimento = empreendimentos.find(e => e.id == finalValue);
            if (empreendimento) {
                updateObject.empresa_id = empreendimento.empresa_proprietaria_id;
            }
        }

        const { error } = await supabase.from('lancamentos').update(updateObject).eq('id', itemId);
        if (error) alert(`Erro ao atualizar: ${error.message}`);
        else if (onUpdate) onUpdate();
    };

    const getPaymentStatus = (item) => {
        if (item.status === 'Pago' || item.conciliado) return { text: 'Paga', className: 'bg-green-100 text-green-800' };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(item.data_vencimento || item.data_transacao);
        if (dueDate < today) return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
        return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
    };

    const filteredAndSortedLancamentos = useMemo(() => {
        let filtered = [...lancamentos];
        if (filters.empresaIds.length > 0) filtered = filtered.filter(l => filters.empresaIds.includes(l.conta?.empresa?.id) || filters.empresaIds.includes(l.empreendimento?.empresa?.id) || filters.empresaIds.includes(l.empresa_id));
        if (filters.contaIds.length > 0) filtered = filtered.filter(l => filters.contaIds.includes(l.conta_id));
        if (filters.categoriaIds.length > 0) filtered = filtered.filter(l => filters.categoriaIds.includes(l.categoria_id));
        if (filters.empreendimentoIds.length > 0) filtered = filtered.filter(l => filters.empreendimentoIds.includes(l.empreendimento_id));
        if (filters.status.length > 0) {
            const hasAtrasada = filters.status.includes('Atrasada');
            const otherStatus = filters.status.filter(s => s !== 'Atrasada');
            filtered = filtered.filter(l => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const isAtrasada = l.status !== 'Pago' && new Date(l.data_vencimento || l.data_transacao) < today;
                return (hasAtrasada && isAtrasada) || otherStatus.includes(l.status);
            });
        }
        if (filters.startDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) >= new Date(filters.startDate));
        if (filters.endDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) <= new Date(filters.endDate + 'T23:59:59'));
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(l => l.descricao.toLowerCase().includes(term) || (l.favorecido?.nome && l.favorecido.nome.toLowerCase().includes(term)) || (l.favorecido?.razao_social && l.favorecido.razao_social.toLowerCase().includes(term)));
        }
        
        const augmentedData = filtered.map(item => {
            const empreendimentoEmpresa = item.empreendimento?.empresa;
            const contaEmpresa = item.conta?.empresa;
            const diretaEmpresa = empresas.find(e => e.id === item.empresa_id);

            const nomeEmpresa = empreendimentoEmpresa?.nome_fantasia || empreendimentoEmpresa?.razao_social ||
                              contaEmpresa?.nome_fantasia || contaEmpresa?.razao_social ||
                              diretaEmpresa?.nome_fantasia || diretaEmpresa?.razao_social ||
                              'N/A';
            
            return { ...item, nomeEmpresa };
        });

        if (sortConfig.key) {
            augmentedData.sort((a, b) => {
                let valA, valB;
                if (sortConfig.key === 'empresa') { valA = a.nomeEmpresa || ''; valB = b.nomeEmpresa || ''; } 
                else if (sortConfig.key === 'empreendimento') { valA = a.empreendimento?.nome || ''; valB = b.empreendimento?.nome || ''; }
                else if (sortConfig.key === 'favorecido') { valA = a.favorecido?.nome || a.favorecido?.razao_social || ''; valB = b.favorecido?.nome || b.favorecido?.razao_social || ''; }
                else if (sortConfig.key === 'categoria') { valA = a.categoria?.nome || ''; valB = b.categoria?.nome || ''; }
                else { valA = a[sortConfig.key]; valB = b[sortConfig.key]; }

                if (valA == null) return 1; if (valB == null) return -1;
                let comparison = 0;
                if (sortConfig.key.startsWith('data_')) { comparison = new Date(valA) - new Date(valB); }
                else if (typeof valA === 'number') { comparison = valA - valB; }
                else { comparison = String(valA).localeCompare(String(valB)); }
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return augmentedData;
    }, [lancamentos, filters, sortConfig, empresas, empreendimentos]);
    
    const formatCurrency = (value, tipo) => {
        const signal = tipo === 'Receita' ? '+' : '-';
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

    return (
        <div className="space-y-4">
             <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faFilter} /> Filtros</h3>
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
                                                    <button onClick={() => handleToggleFavorite(f.name)} className="text-gray-400 hover:text-yellow-500">
                                                        <FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} className={f.isFavorite ? 'text-yellow-500' : ''}/>
                                                    </button>
                                                    <button onClick={() => handleDeleteFilter(f.name)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <FontAwesomeIcon icon={faTrash}/>
                                                    </button>
                                                </div>
                                            </li>
                                        )) : <li className="text-xs text-gray-500">Nenhum filtro salvo.</li>}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-4">
                        <input type="text" name="searchTerm" placeholder="BUSCAR POR DESCRIÇÃO OU FAVORECIDO..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full" />
                    </div>
                    <div className="lg:col-span-2"><MultiSelectDropdown label="Empresas" options={empresas} selectedIds={filters.empresaIds} onChange={(selected) => handleFilterChange('empresaIds', selected)} /></div>
                    <div className="lg:col-span-2"><MultiSelectDropdown label="Empreendimentos" options={empreendimentos} selectedIds={filters.empreendimentoIds} onChange={(selected) => handleFilterChange('empreendimentoIds', selected)} /></div>
                    <div className="lg:col-span-2"><MultiSelectDropdown label="Contas" options={contas} selectedIds={filters.contaIds} onChange={(selected) => handleFilterChange('contaIds', selected)} /></div>
                    <div className="lg:col-span-2"><MultiSelectDropdown label="Categorias" options={categoryTree} selectedIds={filters.categoriaIds} onChange={(selected) => handleFilterChange('categoriaIds', selected)} /></div>
                    
                    <div className="lg:col-span-2 flex items-end gap-2">
                        <div className="flex-1">
                            <label className="text-xs uppercase font-medium text-gray-600">Mês</label>
                            <select name="month" value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm">
                                <option value="">Todos</option>
                                {months.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>
                        <div className="w-28">
                            <label className="text-xs uppercase font-medium text-gray-600">Ano</label>
                            <select name="year" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm">
                                 {years.map(y => <option key={y.id} value={y.id}>{y.nome}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="lg:col-span-2 flex items-end gap-2">
                        <div><label className="text-xs uppercase">Período Personalizado - De:</label><input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                        <div><label className="text-xs uppercase">Até:</label><input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                    </div>
                 </div>
                 <div className="flex justify-end pt-4 mt-4 border-t">
                     <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 w-full md:w-auto uppercase"><FontAwesomeIcon icon={faTimes} /> Limpar Filtros</button>
                 </div>
            </div>

            {savedFilters.filter(f => f.isFavorite).length > 0 && (
                <div className="p-4 border rounded-lg bg-white space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm uppercase text-gray-600"><FontAwesomeIcon icon={faStarSolid} /> Filtros Favoritos</h4>
                    <div className="flex flex-wrap gap-2">
                        {savedFilters.filter(f => f.isFavorite).map((f, i) => (
                            <button key={i} onClick={() => handleLoadFilter(f.settings)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-100 hover:border-gray-400">
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selectedIds.size > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                    <span className="text-sm font-semibold text-blue-800 uppercase">{selectedIds.size} selecionado(s)</span>
                    <button onClick={handleBulkMarkAsPaid} className="bg-green-500 text-white px-4 py-1 rounded-md text-sm font-bold hover:bg-green-600 uppercase"><FontAwesomeIcon icon={faTasks} /> Marcar como Pago</button>
                </div>
            )}
            
            {loading ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : (
                 <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 w-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredAndSortedLancamentos.length} /></th>
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
                            {filteredAndSortedLancamentos.length > 0 ? filteredAndSortedLancamentos.map(item => {
                                const statusInfo = getPaymentStatus(item);
                                const isEditing = editingCell?.id === item.id;
                                const nomeEmpresa = item.nomeEmpresa;

                                return (
                                    <tr key={item.id} className={`${selectedIds.has(item.id) ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectOne(item.id)} /></td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'data_transacao' })}>{isEditing && editingCell.field === 'data_transacao' ? <input type="date" defaultValue={item.data_transacao} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'data_transacao', e.target.value)} className="p-1 border rounded bg-yellow-50"/> : formatDate(item.data_transacao)}</td>
                                        <td className="px-4 py-2 font-medium" onClick={() => setEditingCell({ id: item.id, field: 'descricao' })}>{isEditing && editingCell.field === 'descricao' ? <input defaultValue={item.descricao} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'descricao', e.target.value)} className="w-full p-1 border rounded bg-yellow-50"/> : <span>{item.descricao}</span>}</td>
                                        <td className="px-4 py-2">{item.favorecido?.nome || item.favorecido?.razao_social || 'N/A'}</td>
                                        <td className="px-4 py-2">{item.categoria?.nome || 'N/A'}</td>
                                        <td className="px-4 py-2"><span className="uppercase">{nomeEmpresa}</span></td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'empreendimento_id' })}>{isEditing && editingCell.field === 'empreendimento_id' ? <select defaultValue={item.empreendimento_id || ''} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'empreendimento_id', e.target.value)} className="w-full p-1 border rounded bg-yellow-50"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select> : <span>{item.empreendimento?.nome || 'N/A'}</span>}</td>
                                        <td className={`px-4 py-2 text-right font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`} onClick={() => setEditingCell({ id: item.id, field: 'valor' })}>{isEditing && editingCell.field === 'valor' ? <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} defaultValue={String(item.valor || '')} autoFocus onAccept={(v) => handleInlineUpdate(item.id, 'valor', v)} className="w-full p-1 border rounded bg-yellow-50 text-right"/> : formatCurrency(item.valor, item.tipo)}</td>
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