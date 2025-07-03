"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSpinner, faCopy, faSort, faSortUp, faSortDown, faSave, faPercentage } from '@fortawesome/free-solid-svg-icons';
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
    const [editingCell, setEditingCell] = useState(null);
    const [calculationMethod, setCalculationMethod] = useState('global');
    const [globalValorBase, setGlobalValorBase] = useState('');
    const [valorCub, setValorCub] = useState('');
    const [reajustePercentual, setReajustePercentual] = useState('');

    useEffect(() => {
        setProdutos(initialProdutos || []);
        if (initialProdutos && initialProdutos.length > 0) {
            setGlobalValorBase(String(initialProdutos[0].valor_base || ''));
        }
        if (initialConfig) {
            setValorCub(String(initialConfig.valor_cub || ''));
        }
    }, [initialProdutos, initialConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
        setSortConfig({ key, direction });
    };

    const sortedProdutos = useMemo(() => {
        const items = Array.isArray(produtos) ? [...produtos] : [];
        if (sortConfig.key) {
            items.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA == null) return 1;
                if (valB == null) return -1;
                if (typeof valA === 'number') { return sortConfig.direction === 'ascending' ? valA - valB : valB - valA; }
                return sortConfig.direction === 'ascending' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }
        return items;
    }, [produtos, sortConfig]);

    const fetchProdutos = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).order('unidade');
        if (error) { setMessage('Erro ao recarregar produtos: ' + error.message); } 
        else { setProdutos(data || []); }
        setLoading(false);
    };

    const handleOpenModal = (produto = null) => {
        const valorBaseAtual = calculationMethod === 'global' ? parseFloat(globalValorBase.replace(/\D/g, '')) / 100 : (produto?.area_m2 && parseFloat(valorCub.replace(/\D/g, '')) / 100) * produto.area_m2;
        const produtoComValorBase = { ...produto, valor_base: valorBaseAtual || produto?.valor_base };
        setEditingProduto(produtoComValorBase);
        setIsModalOpen(true);
    };

    const handleDuplicate = (produto) => {
        const produtoParaDuplicar = { ...produto, id: null, unidade: `${produto.unidade}-Copia` };
        setEditingProduto(produtoParaDuplicar);
        setIsModalOpen(true);
    };

    const handleSaveFromModal = async (formData) => {
        setLoading(true);
        const isEditing = Boolean(formData.id);
        const valorBase = parseFloat(formData.valor_base) || 0;
        const fatorReajuste = parseFloat(formData.fator_reajuste_percentual) || 0;
        formData.valor_venda_calculado = valorBase * (1 + (fatorReajuste / 100));
        const { id, ...dataToSave } = formData;
        let error;
        if (isEditing) {
            const { error: updateError } = await supabase.from('produtos_empreendimento').update(dataToSave).eq('id', id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('produtos_empreendimento').insert({ ...dataToSave, empreendimento_id: empreendimentoId });
            error = insertError;
        }
        if (error) { setMessage('Erro ao salvar produto: ' + error.message); setLoading(false); return false; } 
        else { setMessage(`Produto ${isEditing ? 'atualizado' : 'criado'} com sucesso!`); await fetchProdutos(); setLoading(false); setTimeout(() => setMessage(''), 3000); return true; }
    };

    const handleDelete = async (produtoId) => {
        if (!window.confirm("Tem certeza que deseja excluir?")) return;
        const { error } = await supabase.from('produtos_empreendimento').delete().eq('id', produtoId);
        if (error) { alert("Erro ao excluir: " + error.message); } 
        else { setProdutos(produtos.filter(p => p.id !== produtoId)); }
    };
    
    const handleUpdateAllValorBase = async () => {
        const novoValor = parseFloat(globalValorBase.replace(/\D/g, '')) / 100;
        if (isNaN(novoValor)) { setMessage("Insira um Preço Base válido."); return; }
        if (!window.confirm("Isso atualizará o Preço Base para TODOS os produtos. Continuar?")) return;
        setLoading(true); setMessage("Atualizando...");
        const { error } = await supabase.rpc('atualizar_valor_base_produtos', { p_empreendimento_id: empreendimentoId, p_novo_valor_base: novoValor });
        if (error) { setMessage("Erro ao atualizar: " + error.message); } 
        else { setMessage("Produtos atualizados!"); await fetchProdutos(); }
        setLoading(false);
    };

    const handleUpdateValorCub = async () => {
        const novoValorCub = parseFloat(valorCub.replace(/\D/g, '')) / 100;
        if (isNaN(novoValorCub)) { setMessage("Insira um valor de CUB válido."); return; }
        if (!window.confirm("Isso irá recalcular o Preço Base de TODOS os produtos usando o CUB. Continuar?")) return;
        setLoading(true); setMessage("Atualizando com base no CUB...");
        const { error: configError } = await supabase.from('configuracoes_venda').upsert({ empreendimento_id: empreendimentoId, valor_cub: novoValorCub }, { onConflict: 'empreendimento_id' });
        if (configError) { setMessage("Erro ao salvar CUB: " + configError.message); setLoading(false); return; }
        const { error: rpcError } = await supabase.rpc('reajustar_produtos_por_cub', { p_empreendimento_id: empreendimentoId });
        if (rpcError) { setMessage("Erro ao reajustar: " + rpcError.message); } 
        else { setMessage("Produtos atualizados!"); await fetchProdutos(); }
        setLoading(false);
    };
    
    const handleReajusteGeral = async () => {
        const percentual = parseFloat(reajustePercentual);
        if (isNaN(percentual)) { setMessage("Por favor, insira um percentual de reajuste válido."); return; }
        if (!window.confirm(`Isso irá reajustar o PREÇO BASE de todos os produtos em ${percentual}%. Esta ação não pode ser desfeita. Deseja continuar?`)) return;
        setLoading(true);
        setMessage(`Reajustando tabela em ${percentual}%...`);
        const { error } = await supabase.rpc('reajustar_valor_base_produtos', { p_empreendimento_id: empreendimentoId, p_percentual_reajuste: percentual });
        if (error) { setMessage("Erro ao reajustar: " + error.message); } 
        else { setMessage("Tabela reajustada com sucesso!"); await fetchProdutos(); }
        setLoading(false);
        setReajustePercentual('');
    };

    const handleCellClick = (produtoId, field) => { setEditingCell({ id: produtoId, field }); };

    const handleInlineUpdate = async (produtoId, field, value) => {
        setEditingCell(null);
        let produtoOriginal = produtos.find(p => p.id === produtoId);
        
        const numericFields = ['area_m2', 'fator_reajuste_percentual'];
        const finalValue = numericFields.includes(field) ? parseFloat(value) || 0 : value;

        let updatedData = { [field]: finalValue };

        if (field === 'area_m2' || field === 'fator_reajuste_percentual') {
            const fatorReajuste = field === 'fator_reajuste_percentual' ? finalValue : parseFloat(produtoOriginal.fator_reajuste_percentual);
            updatedData.valor_venda_calculado = produtoOriginal.valor_base * (1 + (fatorReajuste / 100));
        }

        const { error } = await supabase.from('produtos_empreendimento').update(updatedData).eq('id', produtoId);

        if (error) {
            setMessage('Erro ao atualizar: ' + error.message);
        } else {
            setProdutos(produtos.map(p => p.id === produtoId ? { ...p, ...updatedData } : p));
        }
    };
    
    const renderEditableCell = (produto, field) => {
        if (editingCell?.id === produto.id && editingCell?.field === field) {
            if (field === 'status') {
                return (
                    <select
                        defaultValue={produto[field]}
                        autoFocus
                        onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                        onChange={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                        className="w-full p-1 border rounded bg-blue-50"
                    >
                        <option>Disponível</option>
                        <option>Reservado</option>
                        <option>Vendido</option>
                    </select>
                );
            }
            return (
                <input
                    type={field === 'fator_reajuste_percentual' || field === 'area_m2' ? 'number' : 'text'}
                    step="0.01"
                    defaultValue={produto[field]}
                    autoFocus
                    onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleInlineUpdate(produto.id, field, e.target.value); if (e.key === 'Escape') setEditingCell(null); }}
                    className={`w-full p-1 border rounded bg-blue-50 ${typeof produto[field] === 'number' ? 'text-right' : 'text-left'}`}
                />
            );
        }
        let displayValue = produto[field];
        if (field === 'fator_reajuste_percentual') displayValue = `${produto[field] || 0}%`;
        return <span className="w-full h-full block" onClick={() => handleCellClick(produto.id, field)}>{displayValue}</span>;
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
                <div className="flex-grow flex flex-wrap items-end gap-6">
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="radio" name="calc_method" value="global" checked={calculationMethod === 'global'} onChange={(e) => setCalculationMethod(e.target.value)} /><span className="font-semibold text-gray-700 text-sm">Preço Base Fixo</span></label>
                        <div className="flex items-center gap-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}} value={globalValorBase} onAccept={(value) => setGlobalValorBase(value)} disabled={calculationMethod !== 'global'} className="p-2 border rounded-md shadow-sm w-48 disabled:bg-gray-200" /><button onClick={handleUpdateAllValorBase} disabled={loading || calculationMethod !== 'global'} className="bg-green-600 text-white px-3 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={faSave} /> Aplicar</button></div>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="radio" name="calc_method" value="cub" checked={calculationMethod === 'cub'} onChange={(e) => setCalculationMethod(e.target.value)} /><span className="font-semibold text-gray-700 text-sm">CUB/m²</span></label>
                        <div className="flex items-center gap-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}} value={valorCub} onAccept={(value) => setValorCub(value)} disabled={calculationMethod !== 'cub'} className="p-2 border rounded-md shadow-sm w-48 disabled:bg-gray-200" /><button onClick={handleUpdateValorCub} disabled={loading || calculationMethod !== 'cub'} className="bg-green-600 text-white px-3 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={faSave} /> Aplicar</button></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Reajustar Tabela (%)</label>
                         <div className="flex items-center gap-2 mt-2">
                            <input type="number" step="0.1" value={reajustePercentual} onChange={e => setReajustePercentual(e.target.value)} className="p-2 border rounded-md shadow-sm w-full max-w-xs" placeholder="Ex: 10 para +10%"/>
                            <button onClick={handleReajusteGeral} disabled={loading} className="bg-orange-500 text-white px-3 py-2 rounded-md shadow-sm hover:bg-orange-600 flex items-center gap-2 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={faPercentage} /> Reajustar</button>
                        </div>
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2 self-end"><FontAwesomeIcon icon={faPlus} />Adicionar Produto</button>
            </div>

            {message && <p className="text-center p-2 bg-green-50 text-green-700 rounded-md text-sm">{message}</p>}
            
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
                                    <td className="px-4 py-2 font-semibold cursor-pointer">{renderEditableCell(produto, 'unidade')}</td>
                                    <td className="px-4 py-2 cursor-pointer">{renderEditableCell(produto, 'tipo')}</td>
                                    <td className="px-4 py-2 text-right cursor-pointer">{renderEditableCell(produto, 'area_m2')}</td>
                                    <td className="px-4 py-2 text-right bg-gray-50">{formatCurrency(produto.valor_base)}</td>
                                    <td className="px-4 py-2 text-right cursor-pointer">{renderEditableCell(produto, 'fator_reajuste_percentual')}</td>
                                    <td className="px-4 py-2 text-right text-gray-600 bg-gray-50">{formatCurrency(precoPorM2)}</td>
                                    <td className="px-4 py-2 text-right font-semibold bg-gray-50">{formatCurrency(produto.valor_venda_calculado)}</td>
                                    <td className="px-4 py-2 text-center cursor-pointer">{renderEditableCell(produto, 'status')}</td>
                                    <td className="px-4 py-2 text-center space-x-2">
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