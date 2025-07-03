"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSpinner, faCopy, faSort, faSortUp, faSortDown, faSave } from '@fortawesome/free-solid-svg-icons';
import ProdutoFormModal from './ProdutoFormModal';
import { IMaskInput } from 'react-imask';

export default function ProdutoList({ initialProdutos, empreendimentoId, initialConfig }) {
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

    const fetchProdutos = async () => { setLoading(true); const { data, error } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).order('unidade'); if (error) { setMessage('Erro: ' + error.message); } else { setProdutos(data || []); } setLoading(false); };
    const requestSort = (key) => { let d = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') d = 'descending'; setSortConfig({ key, d }); };
    const sortedProdutos = useMemo(() => { const i = Array.isArray(produtos) ? [...produtos] : []; if (sortConfig.key) { i.sort((a, b) => { const vA = a[sortConfig.key], vB = b[sortConfig.key]; if (vA == null) return 1; if (vB == null) return -1; if (typeof vA === 'number') return sortConfig.direction === 'ascending' ? vA - vB : vB - vA; return sortConfig.direction === 'ascending' ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA)); }); } return i; }, [produtos, sortConfig]);
    const handleOpenModal = (produto = null) => { setEditingProduto(produto); setIsModalOpen(true); };
    const handleDuplicate = (produto) => { const p = { ...produto, id: null, unidade: `${produto.unidade}-Copia` }; setEditingProduto(p); setIsModalOpen(true); };
    const handleDelete = async (id) => { if (!window.confirm("Tem certeza?")) return; const { error } = await supabase.from('produtos_empreendimento').delete().eq('id', id); if (error) alert("Erro: " + error.message); else setProdutos(produtos.filter(p => p.id !== id)); };

    const handleSaveFromModal = async (formData) => {
        setLoading(true);
        const isEditing = Boolean(formData.id);
        const valorBase = parseFloat(String(formData.valor_base).replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;
        const fatorReajuste = parseFloat(formData.fator_reajuste_percentual) || 0;
        formData.valor_venda_calculado = valorBase * (1 + (fatorReajuste / 100));
        
        const { id, ...dataToSave } = formData;
        let error;
        if (isEditing) {
            ({ error } = await supabase.from('produtos_empreendimento').update(dataToSave).eq('id', id));
        } else {
            ({ error } = await supabase.from('produtos_empreendimento').insert({ ...dataToSave, empreendimento_id: empreendimentoId }));
        }

        if (error) { setMessage('Erro: ' + error.message); setLoading(false); return false; } 
        else { setMessage(`Produto salvo!`); await fetchProdutos(); setLoading(false); setTimeout(() => setMessage(''), 3000); return true; }
    };

    // ***** INÍCIO DA CORREÇÃO DEFINITIVA *****
    const handleUpdateValorCub = async () => {
        const novoValorCub = parseFloat(valorCub.replace(/\D/g, '')) / 100;
        if (isNaN(novoValorCub) || novoValorCub <= 0) {
            setMessage("Insira um valor de CUB válido.");
            return;
        }
        if (!window.confirm("Isso irá recalcular o Preço Base de TODOS os produtos usando a fórmula (CUB x Área). Continuar?")) return;
        
        setLoading(true);
        setMessage("Calculando e atualizando produtos...");

        // 1. Calcula os novos valores para todos os produtos DIRETAMENTE AQUI
        const updates = produtos.map(produto => {
            const area = parseFloat(produto.area_m2) || 0;
            const fator = parseFloat(produto.fator_reajuste_percentual) || 0;
            const novoValorBase = area * novoValorCub;
            
            return {
                id: produto.id, // ID é crucial para o `upsert` saber qual linha atualizar
                valor_base: novoValorBase,
                valor_venda_calculado: novoValorBase * (1 + (fator / 100))
            };
        });

        // 2. Envia todas as atualizações de uma vez para o banco de dados
        const { error } = await supabase.from('produtos_empreendimento').upsert(updates);

        if (error) {
            setMessage("Erro ao reajustar produtos: " + error.message);
        } else {
            setMessage("Produtos atualizados com sucesso!");
            // 3. Busca os dados atualizados do banco para garantir que a tela reflita a realidade
            await fetchProdutos(); 
        }
        setLoading(false);
    };
    // ***** FIM DA CORREÇÃO DEFINITIVA *****
    
    const handleCellClick = (rowId, field) => { setEditingCell({ rowId, field }); };

    const handleInlineUpdate = async (productId, field, value) => {
        const produtoOriginal = produtos.find(p => p.id === productId);
        if (!produtoOriginal) return;

        let finalValue = value;
        if (field === 'area_m2' || field === 'fator_reajuste_percentual') {
            finalValue = parseFloat(String(value).replace(/[^0-9,.]+/g, "").replace(",", ".")) || 0;
        }
        
        const updateData = { [field]: finalValue };
        
        const area = field === 'area_m2' ? finalValue : parseFloat(produtoOriginal.area_m2);
        const fatorReajuste = field === 'fator_reajuste_percentual' ? finalValue : parseFloat(produtoOriginal.fator_reajuste_percentual);
        
        if (field === 'area_m2') {
            const cubAtual = parseFloat(valorCub.replace(/\D/g, '')) / 100 || 0;
            if(cubAtual > 0) {
              updateData.valor_base = area * cubAtual;
            }
        }

        const valorBase = updateData.valor_base || parseFloat(produtoOriginal.valor_base);
        updateData.valor_venda_calculado = valorBase * (1 + (fatorReajuste / 100));

        const { error } = await supabase.from('produtos_empreendimento').update(updateData).eq('id', productId);

        if (error) {
            setMessage(`Erro ao atualizar: ${error.message}`);
        } else {
            setProdutos(prev => prev.map(p => p.id === productId ? { ...p, ...updateData } : p));
        }
        setEditingCell(null);
    };

    const renderEditableCell = (produto, field, formatFn) => {
        if (editingCell?.rowId === produto.id && editingCell?.field === field) {
            if (field === 'status') {
                return (
                    <select
                        defaultValue={produto[field]}
                        onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }}
                        autoFocus
                        className="p-1 border rounded-md w-full bg-yellow-50"
                    >
                        <option>Disponível</option>
                        <option>Reservado</option>
                        <option>Vendido</option>
                    </select>
                );
            }
            return (
                <input
                    type="text"
                    defaultValue={produto[field]}
                    onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }}
                    autoFocus
                    className="p-1 border rounded-md w-full bg-yellow-50 text-right"
                />
            );
        }
        return <div className="cursor-pointer" onClick={() => handleCellClick(produto.id, field)}>{formatFn ? formatFn(produto[field]) : produto[field]}</div>;
    };
    
    const formatCurrency = (value) => value == null || isNaN(value) ? 'N/A' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const SortableHeader = ({ sortKey, label, className = '' }) => {
        const icon = sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort;
        return (<th className={`px-4 py-3 text-xs font-bold uppercase ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full">{label}<FontAwesomeIcon icon={icon} className="text-gray-400" /></button></th>);
    };

    return (
        <div className="space-y-4">
            <ProdutoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveFromModal} produtoToEdit={editingProduto} />

            <div className="flex flex-wrap justify-between items-end gap-4 p-4 bg-gray-50 rounded-lg border">
                 <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <span className="font-semibold text-gray-700 text-sm">CUB/m²</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}} value={valorCub} onAccept={(value) => setValorCub(value)} className="p-2 border rounded-md shadow-sm w-48" />
                        <button onClick={handleUpdateValorCub} disabled={loading} className="bg-green-600 text-white px-3 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 text-sm">
                            <FontAwesomeIcon icon={faSave} /> Aplicar CUB
                        </button>
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
                            <SortableHeader sortKey="area_m2" label="Área (m²)" className="text-right" />
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Preço Base</th>
                            <SortableHeader sortKey="fator_reajuste_percentual" label="Fator (%)" className="text-right" />
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Preço/m²</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor de Venda</th>
                            <SortableHeader sortKey="status" label="Status" className="text-center" />
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="9" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                        ) : sortedProdutos.length > 0 ? (
                            sortedProdutos.map(produto => {
                                const precoPorM2 = (produto.area_m2 && produto.area_m2 > 0) ? produto.valor_venda_calculado / produto.area_m2 : 0;
                                return (
                                <tr key={produto.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-semibold">{renderEditableCell(produto, 'unidade')}</td>
                                    <td className="px-4 py-2">{renderEditableCell(produto, 'tipo')}</td>
                                    <td className="px-4 py-2 text-right">{renderEditableCell(produto, 'area_m2')}</td>
                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(produto.valor_base)}</td>
                                    <td className="px-4 py-2 text-right">{renderEditableCell(produto, 'fator_reajuste_percentual', (v) => `${v}%`)}</td>
                                    <td className="px-4 py-2 text-right text-gray-600 bg-gray-50">{formatCurrency(precoPorM2)}</td>
                                    <td className="px-4 py-2 text-right font-semibold bg-gray-50">{formatCurrency(produto.valor_venda_calculado)}</td>
                                    <td className="px-4 py-2 text-center">{renderEditableCell(produto, 'status')}</td>
                                    <td className="px-4 py-2 text-center space-x-2">
                                        <button onClick={() => handleOpenModal(produto)} title="Editar no Modal" className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faEdit} /></button>
                                        <button onClick={() => handleDuplicate(produto)} title="Duplicar" className="text-gray-500 hover:text-gray-700"><FontAwesomeIcon icon={faCopy} /></button>
                                        <button onClick={() => handleDelete(produto.id)} title="Excluir" className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            )})
                        ) : (
                            <tr><td colSpan="9" className="text-center py-10 text-gray-500">Nenhum produto cadastrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}