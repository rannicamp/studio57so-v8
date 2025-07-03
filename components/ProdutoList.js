"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSpinner, faCopy, faSort, faSortUp, faSortDown, faSave } from '@fortawesome/free-solid-svg-icons';
import ProdutoFormModal from './ProdutoFormModal';
import { IMaskInput } from 'react-imask';

export default function ProdutoList({ initialProdutos, empreendimentoId, initialConfig, onUpdate }) {
    const supabase = createClient();
    const [produtos, setProdutos] = useState(initialProdutos || []);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduto, setEditingProduto] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'unidade', direction: 'ascending' });
    const [valorCub, setValorCub] = useState('');
    const [editingCell, setEditingCell] = useState(null);

    useEffect(() => {
        setProdutos(initialProdutos || []);
        if (initialConfig) {
            setValorCub(String(initialConfig.valor_cub || ''));
        }
    }, [initialProdutos, initialConfig]);
    
    const requestSort = (key) => { let d = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') d = 'descending'; setSortConfig({ key, d }); };
    const sortedProdutos = useMemo(() => { const i = Array.isArray(produtos) ? [...produtos] : []; if (sortConfig.key) { i.sort((a, b) => { const vA = a[sortConfig.key], vB = b[sortConfig.key]; if (vA == null) return 1; if (vB == null) return -1; if (typeof vA === 'number') return sortConfig.direction === 'ascending' ? vA - vB : vB - vA; return sortConfig.direction === 'ascending' ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA)); }); } return i; }, [produtos, sortConfig]);
    const handleOpenModal = (produto = null) => { setEditingProduto(produto); setIsModalOpen(true); };
    const handleDuplicate = (produto) => { const p = { ...produto, id: null, unidade: `${produto.unidade}-Copia` }; setEditingProduto(p); setIsModalOpen(true); };
    const handleDelete = async (id) => { if (!window.confirm("Tem certeza?")) return; const { error } = await supabase.from('produtos_empreendimento').delete().eq('id', id); if (error) alert("Erro: " + error.message); else onUpdate(); };

    const handleSaveFromModal = async (formData) => {
        setLoading(true);
        const isEditing = Boolean(formData.id);
        const dataToSave = {...formData};
        dataToSave.area_m2 = parseFloat(String(dataToSave.area_m2).replace('.', '').replace(',', '.')) || null;
        dataToSave.valor_base = parseFloat(String(dataToSave.valor_base).replace(/[^0-9,]/g, '').replace(',', '.')) || null;
        dataToSave.fator_reajuste_percentual = parseFloat(String(dataToSave.fator_reajuste_percentual).replace(',', '.')) || 0;
        if (dataToSave.valor_base !== null) { dataToSave.valor_venda_calculado = dataToSave.valor_base * (1 + (dataToSave.fator_reajuste_percentual / 100)); } else { dataToSave.valor_venda_calculado = null; }
        const { id, ...dbData } = dataToSave;
        let error;
        if (isEditing) { ({ error } = await supabase.from('produtos_empreendimento').update(dbData).eq('id', id)); } 
        else { ({ error } = await supabase.from('produtos_empreendimento').insert({ ...dbData, empreendimento_id: empreendimentoId })); }
        if (error) { setMessage('Erro: ' + error.message); setLoading(false); return false; } 
        else { setMessage(`Produto salvo!`); onUpdate(); setLoading(false); setTimeout(() => setMessage(''), 3000); return true; }
    };

    const handleUpdateValorCub = async () => {
        const novoValorCub = parseFloat(valorCub.replace(/\D/g, '')) / 100;
        if (isNaN(novoValorCub) || novoValorCub <= 0) { setMessage("Insira um valor de CUB válido."); return; }
        if (!window.confirm("Isso irá recalcular o Preço Base dos produtos com área definida, usando a fórmula (CUB x Área). Continuar?")) return;
        setLoading(true);
        setMessage("Calculando e atualizando produtos...");
        const produtosParaAtualizar = produtos.filter(p => p.area_m2 && !isNaN(parseFloat(p.area_m2)) && parseFloat(p.area_m2) > 0);
        if (produtosParaAtualizar.length === 0) { setMessage("Nenhum produto com área válida para aplicar o CUB foi encontrado."); setLoading(false); return; }
        const updates = produtosParaAtualizar.map(produto => {
            const area = parseFloat(produto.area_m2);
            const fator = parseFloat(produto.fator_reajuste_percentual) || 0;
            const novoValorBase = area * novoValorCub;
            return { id: produto.id, valor_base: novoValorBase, valor_venda_calculado: novoValorBase * (1 + (fator / 100)) };
        });
        const { error } = await supabase.from('produtos_empreendimento').upsert(updates);
        if (error) { setMessage("Erro ao reajustar produtos: " + error.message); } 
        else { await supabase.from('configuracoes_venda').upsert({ empreendimento_id: empreendimentoId, valor_cub: novoValorCub }, { onConflict: 'empreendimento_id' }); setMessage(`${updates.length} produtos foram atualizados com sucesso!`); onUpdate(); }
        setLoading(false);
    };
    
    const handleCellClick = (rowId, field) => { setEditingCell({ rowId, field }); };

    const handleInlineUpdate = async (productId, field, value) => {
        const produtoOriginal = produtos.find(p => p.id === productId);
        if (!produtoOriginal) return;
        const updatedValues = { ...produtoOriginal };
        let finalValue = value;
        if (field === 'valor_venda_calculado' || field === 'fator_reajuste_percentual') {
            finalValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        }
        updatedValues[field] = finalValue;
        if (field === 'fator_reajuste_percentual') {
            const valorBase = parseFloat(updatedValues.valor_base) || 0;
            if (valorBase > 0) updatedValues.valor_venda_calculado = valorBase * (1 + (finalValue / 100));
        } else if (field === 'valor_venda_calculado') {
            const valorBase = parseFloat(updatedValues.valor_base) || 0;
            if (valorBase > 0) updatedValues.fator_reajuste_percentual = ((finalValue / valorBase) - 1) * 100;
        }
        const { valor_venda_calculado, fator_reajuste_percentual, status } = updatedValues;
        const { error } = await supabase.from('produtos_empreendimento').update({ valor_venda_calculado, fator_reajuste_percentual, status }).eq('id', productId);
        if (error) { setMessage(`Erro: ${error.message}`); } else { onUpdate(); }
        setEditingCell(null);
    };
    
    const renderEditableCell = (produto, field, formatFn) => {
        if (editingCell?.rowId === produto.id && editingCell?.field === field) {
            if (field === 'status') {
                return (
                    <select
                        defaultValue={produto[field]}
                        onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }}
                        autoFocus
                        className="p-1 border rounded-md w-full bg-yellow-50"
                    >
                        <option>Disponível</option>
                        <option>Reservado</option>
                        <option>Vendido</option>
                    </select>
                );
            }
            return ( <input type="text" defaultValue={produto[field]} onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }} autoFocus className="p-1 border rounded-md w-full bg-yellow-50 text-right"/> );
        }
        return <div className="cursor-pointer p-1" onClick={() => handleCellClick(produto.id, field)}>{formatFn ? formatFn(produto[field]) : produto[field]}</div>;
    };
    
    const formatCurrency = (value) => value == null || isNaN(value) ? 'N/A' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const formatPercent = (value) => value == null || isNaN(value) ? 'N/A' : `${Number(value).toFixed(4)}%`;
    const SortableHeader = ({ sortKey, label, className = '' }) => { const icon = sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort; return (<th className={`px-4 py-3 text-xs font-bold uppercase ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full">{label}<FontAwesomeIcon icon={icon} className="text-gray-400" /></button></th>); };

    return (
        <div className="space-y-4">
            <ProdutoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveFromModal} produtoToEdit={editingProduto} />
            <div className="flex flex-wrap justify-between items-end gap-4 p-4 bg-gray-50 rounded-lg border">
                 <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2"><span className="font-semibold text-gray-700 text-sm">CUB/m²</span></label>
                    <div className="flex items-center gap-2">
                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}} value={valorCub} onAccept={(value) => setValorCub(value)} className="p-2 border rounded-md shadow-sm w-48" />
                        <button onClick={handleUpdateValorCub} disabled={loading} className="bg-green-600 text-white px-3 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"> <FontAwesomeIcon icon={faSave} /> Aplicar CUB </button>
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2 self-end"><FontAwesomeIcon icon={faPlus} />Adicionar Produto</button>
            </div>
            {message && <p className="text-center p-2 bg-blue-100 text-blue-800 rounded-md text-sm">{message}</p>}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableHeader sortKey="unidade" label="Unidade" className="text-left" />
                            <SortableHeader sortKey="tipo" label="Tipo" className="text-left" />
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Preço Base</th>
                            <SortableHeader sortKey="fator_reajuste_percentual" label="Fator (%)" className="text-right" />
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor de Venda</th>
                            <SortableHeader sortKey="status" label="Status" className="text-center" />
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? ( <tr><td colSpan="7" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                        ) : sortedProdutos.length > 0 ? (
                            sortedProdutos.map(produto => (
                                <tr key={produto.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-semibold">{produto.unidade}</td>
                                    <td className="px-4 py-2">{produto.tipo}</td>
                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(produto.valor_base)}</td>
                                    <td className="px-4 py-2 text-right">{renderEditableCell(produto, 'fator_reajuste_percentual', formatPercent)}</td>
                                    <td className="px-4 py-2 text-right font-semibold bg-gray-50">{renderEditableCell(produto, 'valor_venda_calculado', formatCurrency)}</td>
                                    <td className="px-4 py-2 text-center">{renderEditableCell(produto, 'status')}</td>
                                    <td className="px-4 py-2 text-center space-x-2">
                                        <button onClick={() => handleOpenModal(produto)} title="Editar no Modal" className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faEdit} /></button>
                                        <button onClick={() => handleDuplicate(produto)} title="Duplicar" className="text-gray-500 hover:text-gray-700"><FontAwesomeIcon icon={faCopy} /></button>
                                        <button onClick={() => handleDelete(produto.id)} title="Excluir" className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            ))
                        ) : ( <tr><td colSpan="7" className="text-center py-10 text-gray-500">Nenhum produto cadastrado.</td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}