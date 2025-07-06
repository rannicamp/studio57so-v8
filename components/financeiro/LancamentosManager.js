"use client";

import { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFilter, faTimes, faPenToSquare, faTrash, faSort, faSortUp, faSortDown, faTasks } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { IMaskInput } from 'react-imask';

const SortableHeader = ({ label, sortKey, sortConfig, requestSort, className = '' }) => {
    const getIcon = () => {
        if (sortConfig.key !== sortKey) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };
    return (
        <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 hover:text-gray-900">
                <span>{label}</span>
                <FontAwesomeIcon icon={getIcon()} className="text-gray-400" />
            </button>
        </th>
    );
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
    const [loading, setLoading] = useState(initialLoading);
    
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [editingCell, setEditingCell] = useState(null);
    
    const [filters, setFilters] = useState({
        searchTerm: '', contaId: '', categoriaId: '', empreendimentoId: '', empresaId: '', startDate: '', endDate: '', status: ''
    });
    
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });
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

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ searchTerm: '', contaId: '', categoriaId: '', empreendimentoId: '', empresaId: '', startDate: '', endDate: '', status: '' });
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
        
        if (field === 'valor') finalValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0;
        if (String(originalItem[field]) === String(finalValue)) return;
        
        const updateObject = { [field]: finalValue };

        if (field === 'empreendimento_id') {
            const empreendimento = empreendimentos.find(e => e.id == finalValue);
            if (empreendimento) {
                updateObject.empresa_id = empreendimento.empresa_proprietaria_id;
            } else {
                updateObject.empresa_id = null;
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
        if (filters.empresaId) filtered = filtered.filter(l => l.empresa_id == filters.empresaId);
        if (filters.contaId) filtered = filtered.filter(l => l.conta_id == filters.contaId);
        if (filters.categoriaId) filtered = filtered.filter(l => l.categoria_id == filters.categoriaId);
        if (filters.empreendimentoId) filtered = filtered.filter(l => l.empreendimento_id == filters.empreendimentoId);
        if (filters.status) {
             if (filters.status === 'Atrasada') {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                filtered = filtered.filter(l => l.status !== 'Pago' && new Date(l.data_vencimento || l.data_transacao) < today);
            } else { filtered = filtered.filter(l => l.status === filters.status); }
        }
        if (filters.startDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) >= new Date(filters.startDate));
        if (filters.endDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) <= new Date(filters.endDate + 'T23:59:59'));
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(l => l.descricao.toLowerCase().includes(term) || (l.favorecido?.nome && l.favorecido.nome.toLowerCase().includes(term)) || (l.favorecido?.razao_social && l.favorecido.razao_social.toLowerCase().includes(term)));
        }
        
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let valA, valB;

                // Extração de valores com lógica específica para campos aninhados
                if (sortConfig.key === 'empresa') {
                    valA = a.empreendimento?.empresa?.nome_fantasia || a.empresa?.nome_fantasia || '';
                    valB = b.empreendimento?.empresa?.nome_fantasia || b.empresa?.nome_fantasia || '';
                } else if (sortConfig.key === 'empreendimento') {
                    valA = a.empreendimento?.nome || '';
                    valB = b.empreendimento?.nome || '';
                } else {
                    valA = a[sortConfig.key];
                    valB = b[sortConfig.key];
                }

                if (valA == null) return 1;
                if (valB == null) return -1;

                let comparison = 0;
                // CORREÇÃO APLICADA: Lógica de comparação melhorada
                if (sortConfig.key.startsWith('data_')) {
                    comparison = new Date(valA) - new Date(valB);
                } else if (typeof valA === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = String(valA).localeCompare(String(valB));
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return filtered;
    }, [lancamentos, filters, sortConfig]);
    
    const formatCurrency = (value, tipo) => {
        const signal = tipo === 'Receita' ? '+' : '-';
        return `${signal} ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value || 0))}`;
    };
    
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    return (
        <div className="space-y-4">
             <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><FontAwesomeIcon icon={faFilter} /> Filtros</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" name="searchTerm" placeholder="Buscar por descrição ou favorecido..." value={filters.searchTerm} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm lg:col-span-4" />
                    
                    <select name="empresaId" value={filters.empresaId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm">
                        <option value="">Todas as Empresas</option>
                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}
                    </select>

                    <select name="empreendimentoId" value={filters.empreendimentoId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm"><option value="">Todos Empreendimentos</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
                    <select name="contaId" value={filters.contaId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm"><option value="">Todas as Contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm">
                        <option value="">Todos os Status</option> <option value="Pago">Paga</option> <option value="Pendente">A Pagar</option> <option value="Atrasada">Atrasada</option>
                    </select>
                    <div><label className="text-xs">De:</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md shadow-sm"/></div>
                    <div><label className="text-xs">Até:</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md shadow-sm"/></div>
                    <div className="lg:col-span-2 flex justify-end items-end"><button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 w-full md:w-auto"><FontAwesomeIcon icon={faTimes} /> Limpar Filtros</button></div>
                 </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                    <span className="text-sm font-semibold text-blue-800">{selectedIds.size} selecionado(s)</span>
                    <button onClick={handleBulkMarkAsPaid} className="bg-green-500 text-white px-4 py-1 rounded-md text-sm font-bold hover:bg-green-600"><FontAwesomeIcon icon={faTasks} /> Marcar como Pago</button>
                </div>
            )}
            
            {loading ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : (
                 <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 w-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredAndSortedLancamentos.length} /></th>
                                <SortableHeader label="Vencimento" sortKey="data_vencimento" sortConfig={sortConfig} requestSort={requestSort} />
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase w-1/4">Descrição</th>
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
                                const nomeEmpresa = item.empreendimento?.empresa?.nome_fantasia || item.empresa?.nome_fantasia || 'N/A';

                                return (
                                    <tr key={item.id} className={`${selectedIds.has(item.id) ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectOne(item.id)} /></td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'data_vencimento' })}>{isEditing && editingCell.field === 'data_vencimento' ? <input type="date" defaultValue={item.data_vencimento || item.data_transacao} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'data_vencimento', e.target.value)} className="p-1 border rounded bg-yellow-50"/> : formatDate(item.data_vencimento || item.data_transacao)}</td>
                                        <td className="px-4 py-2 font-medium" onClick={() => setEditingCell({ id: item.id, field: 'descricao' })}>{isEditing && editingCell.field === 'descricao' ? <input defaultValue={item.descricao} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'descricao', e.target.value)} className="w-full p-1 border rounded bg-yellow-50"/> : <span>{item.descricao}</span>}</td>
                                        <td className="px-4 py-2" onClick={() => !item.empreendimento_id && setEditingCell({ id: item.id, field: 'empresa_id' })}>
                                            {isEditing && editingCell.field === 'empresa_id' && !item.empreendimento_id
                                                ? <select defaultValue={item.empresa_id} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'empresa_id', e.target.value)} className="w-full p-1 border rounded bg-yellow-50"><option value="">Nenhuma</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}</select> 
                                                : <span>{nomeEmpresa}</span>}
                                        </td>
                                        <td className="px-4 py-2" onClick={() => setEditingCell({ id: item.id, field: 'empreendimento_id' })}>{isEditing && editingCell.field === 'empreendimento_id' ? <select defaultValue={item.empreendimento_id || ''} autoFocus onBlur={(e) => handleInlineUpdate(item.id, 'empreendimento_id', e.target.value)} className="w-full p-1 border rounded bg-yellow-50"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select> : <span>{item.empreendimento?.nome || 'N/A'}</span>}</td>
                                        <td className={`px-4 py-2 text-right font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`} onClick={() => setEditingCell({ id: item.id, field: 'valor' })}>{isEditing && editingCell.field === 'valor' ? <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} defaultValue={String(item.valor || '')} autoFocus onAccept={(v) => handleInlineUpdate(item.id, 'valor', v)} className="w-full p-1 border rounded bg-yellow-50 text-right"/> : formatCurrency(item.valor, item.tipo)}</td>
                                        <td className="px-4 py-2 text-center text-xs"><span className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className}`}>{statusInfo.text}</span></td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => onEdit(item)} className="text-blue-500 hover:text-blue-700 mr-3" title="Editar Completo"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                            <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-500">Nenhum lançamento encontrado. Tente limpar os filtros.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}