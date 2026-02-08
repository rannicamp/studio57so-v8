"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; // Ajustei para @/utils para garantir o caminho
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext'; // Ajustei para @/contexts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faSpinner, faCopy, 
  faSort, faSortUp, faSortDown, faSave, faDollarSign, faTasks 
} from '@fortawesome/free-solid-svg-icons';
import ProdutoFormModal from './ProdutoFormModal';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';

export default function ProdutoList({ initialProdutos, empreendimentoId, initialConfig, onUpdate }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [produtos, setProdutos] = useState(initialProdutos || []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduto, setEditingProduto] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'unidade', direction: 'ascending' });
    const [editingCell, setEditingCell] = useState(null);
    
    const [selectedProdutos, setSelectedProdutos] = useState(new Set());
    const [bulkPrecoM2, setBulkPrecoM2] = useState('');

    useEffect(() => {
        setProdutos(initialProdutos || []);
    }, [initialProdutos]);

    const handleSuccess = () => {
        if (onUpdate) onUpdate(); 
        queryClient.invalidateQueries({ queryKey: ['comercializacaoData', empreendimentoId] });
        setSelectedProdutos(new Set()); 
        setBulkPrecoM2('');
    };
    
    // =================================================================================
    // ATUALIZAÇÃO EM MASSA (BLINDADA)
    // Agora recalcula também o Valor de Venda Final baseado no Fator
    // =================================================================================
    const bulkUpdatePrecoM2Mutation = useMutation({
        mutationFn: async (newPrecoM2Value) => {
            const newPrecoM2 = parseFloat(String(newPrecoM2Value).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
            if (newPrecoM2 <= 0) throw new Error("Insira um Preço/m² válido.");
            if (selectedProdutos.size === 0) throw new Error("Nenhum produto selecionado.");

            const updatePromises = Array.from(selectedProdutos).map(productId => {
                const produto = produtos.find(p => p.id === productId);
                if (!produto) return null;

                const area = parseFloat(produto.area_m2) || 0;
                const novoValorBase = area * newPrecoM2;
                
                // CORREÇÃO DO DEVONILDO: Recalcular o valor final também no bulk update
                const fator = parseFloat(produto.fator_reajuste_percentual) || 0;
                const novoValorFinal = novoValorBase * (1 + (fator / 100));

                return supabase
                    .from('produtos_empreendimento')
                    .update({ 
                        preco_m2: newPrecoM2, 
                        valor_base: novoValorBase,
                        valor_venda_calculado: novoValorFinal 
                    })
                    .eq('id', productId);
            }).filter(Boolean);

            const results = await Promise.all(updatePromises);
            results.forEach(result => {
                if (result.error) throw new Error(`Falha ao atualizar produto: ${result.error.message}`);
            });

            return selectedProdutos.size;
        },
        onSuccess: (count) => {
            handleSuccess();
            toast.success(`${count} produtos foram atualizados com sucesso!`);
        },
        onError: (error) => toast.error(error.message),
    });

    const sellProductMutation = useMutation({
        mutationFn: async (produto) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            const { data: newContract, error: contractError } = await supabase.from('contratos').insert({ empreendimento_id: empreendimentoId, produto_id: produto.id, valor_final_venda: produto.valor_venda_calculado, status_contrato: 'Em assinatura', organizacao_id: organizacaoId }).select('id').single();
            if (contractError) throw new Error(`Erro ao criar o contrato: ${contractError.message}`);
            const { error: productError } = await supabase.from('produtos_empreendimento').update({ status: 'Vendido' }).eq('id', produto.id);
            if (productError) { await supabase.from('contratos').delete().eq('id', newContract.id); throw new Error(`Erro ao atualizar o produto: ${productError.message}`); }
            return newContract.id;
        },
        onSuccess: (newContractId) => { handleSuccess(); router.push(`/contratos/${newContractId}`); toast.success(`Venda iniciada! Contrato #${newContractId} criado.`); },
        onError: (error) => toast.error(error.message),
    });

    const deleteProductMutation = useMutation({
        mutationFn: (id) => supabase.from('produtos_empreendimento').delete().eq('id', id).throwOnError(),
        onSuccess: () => { handleSuccess(); toast.success("Produto excluído com sucesso!"); },
        onError: (error) => toast.error(`Erro ao excluir: ${error.message}`),
    });

    const saveProductMutation = useMutation({
        mutationFn: async (formData) => {
            const isEditing = Boolean(formData.id);
            const dataToSave = { ...formData };
            dataToSave.area_m2 = parseFloat(String(dataToSave.area_m2).replace('.', '').replace(',', '.')) || null;
            dataToSave.valor_base = parseFloat(String(dataToSave.valor_base).replace(/[^0-9,]/g, '').replace(',', '.')) || null;
            dataToSave.preco_m2 = parseFloat(String(dataToSave.preco_m2).replace(/[^0-9,]/g, '').replace(',', '.')) || null;
            dataToSave.fator_reajuste_percentual = parseFloat(String(dataToSave.fator_reajuste_percentual).replace(',', '.')) || 0;
            if (dataToSave.valor_base !== null) { dataToSave.valor_venda_calculado = dataToSave.valor_base * (1 + (dataToSave.fator_reajuste_percentual / 100)); } else { dataToSave.valor_venda_calculado = null; }
            const { id, ...dbData } = dataToSave;
            let query;
            if (isEditing) { query = supabase.from('produtos_empreendimento').update(dbData).eq('id', id); } 
            else { if (!organizacaoId) throw new Error("Organização não identificada."); query = supabase.from('produtos_empreendimento').insert({ ...dbData, empreendimento_id: empreendimentoId, organizacao_id: organizacaoId }); }
            const { error } = await query;
            if (error) throw error;
        },
        onSuccess: () => { handleSuccess(); setIsModalOpen(false); },
    });

    // =================================================================================
    // LÓGICA DE EDIÇÃO INLINE (APROVADA PELO MENTOR)
    // Mantém a integridade: Mexeu no Fator? Mexeu na Base? O Final recalcula.
    // =================================================================================
    const inlineUpdateMutation = useMutation({
        mutationFn: async ({ productId, field, value }) => {
            const produtoOriginal = produtos.find(p => p.id === productId);
            if (!produtoOriginal) throw new Error("Produto não encontrado.");

            const updatedValues = {};
            const area = parseFloat(produtoOriginal.area_m2) || 0;
            const cleanValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
            
            // Lida com a atualização dos campos e suas interdependências
            if (field === 'preco_m2' && area > 0) {
                updatedValues.preco_m2 = cleanValue;
                updatedValues.valor_base = area * cleanValue;
            } else if (field === 'valor_base' && area > 0) {
                updatedValues.valor_base = cleanValue;
                updatedValues.preco_m2 = cleanValue / area;
            } else if (field === 'fator_reajuste_percentual') {
                updatedValues.fator_reajuste_percentual = cleanValue;
            } else if (field === 'status') {
                updatedValues.status = value; // status é texto
            }

            // Sempre recalcula o valor de venda final com base nos valores mais atuais (novos ou existentes)
            const base = updatedValues.valor_base ?? parseFloat(produtoOriginal.valor_base);
            const fator = updatedValues.fator_reajuste_percentual ?? parseFloat(produtoOriginal.fator_reajuste_percentual);

            if (base != null && fator != null) {
                updatedValues.valor_venda_calculado = base * (1 + (fator / 100));
            }

            if (Object.keys(updatedValues).length === 0) return;

            await supabase.from('produtos_empreendimento').update(updatedValues).eq('id', productId).throwOnError();
        },
        onSuccess: () => { handleSuccess(); setEditingCell(null); },
        onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`),
    });

    const handleSellProduct = (produto) => toast("Iniciar Venda", { description: `Criar um novo contrato para a Unidade ${produto.unidade}?`, action: { label: "Confirmar", onClick: () => sellProductMutation.mutate(produto) }, cancel: { label: "Cancelar" } });
    const handleDelete = (id) => toast("Confirmar Exclusão", { description: "Esta ação não pode ser desfeita. Deseja realmente excluir este produto?", action: { label: "Excluir", onClick: () => deleteProductMutation.mutate(id) }, cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' } });
    const handleSaveFromModal = (formData) => { const promise = saveProductMutation.mutateAsync(formData); toast.promise(promise, { loading: 'Salvando produto...', success: 'Produto salvo com sucesso!', error: (err) => err.message || 'Ocorreu um erro.' }); return promise.then(() => true).catch(() => false); };
    const handleBulkUpdate = () => bulkUpdatePrecoM2Mutation.mutate(bulkPrecoM2);

    const handleSelectProduto = (id) => {
        const newSelection = new Set(selectedProdutos);
        if (newSelection.has(id)) { newSelection.delete(id); } else { newSelection.add(id); }
        setSelectedProdutos(newSelection);
    };
    const handleSelectAll = (e) => {
        if (e.target.checked) { setSelectedProdutos(new Set(sortedProdutos.map(p => p.id))); } else { setSelectedProdutos(new Set()); }
    };
    
    const sortedProdutos = useMemo(() => {
        const items = Array.isArray(produtos) ? [...produtos] : [];
        if (sortConfig.key) { items.sort((a, b) => { const vA = a[sortConfig.key], vB = b[sortConfig.key]; if (vA == null) return 1; if (vB == null) return -1; const numA = parseFloat(vA); const numB = parseFloat(vB); if (!isNaN(numA) && !isNaN(numB)) { return sortConfig.direction === 'ascending' ? numA - numB : numB - numA; } return sortConfig.direction === 'ascending' ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA)); }); }
        return items;
    }, [produtos, sortConfig]);

    const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending'; setSortConfig({ key, direction }); };
    const handleOpenModal = (produto = null) => { setEditingProduto(produto); setIsModalOpen(true); };
    const handleDuplicate = (produto) => { const p = { ...produto, id: null, unidade: `${produto.unidade}-Copia` }; setEditingProduto(p); setIsModalOpen(true); };
    const handleCellClick = (rowId, field) => setEditingCell({ rowId, field });
    const handleInlineUpdate = (productId, field, value) => inlineUpdateMutation.mutate({ productId, field, value });
    
    const renderEditableCell = (produto, field, formatFn) => {
        const nonEditableFields = ['valor_venda_calculado'];
        if (nonEditableFields.includes(field)) {
             return <div className="p-1">{formatFn ? formatFn(produto[field]) : produto[field]}</div>;
        }

        if (editingCell?.rowId === produto.id && editingCell?.field === field) {
            if (field === 'status') { return ( <select defaultValue={produto[field]} onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }} autoFocus className="p-1 border rounded-md w-full bg-yellow-50 text-black"> <option>Disponível</option> <option>Reservado</option> <option>Vendido</option> </select> ); }
            return ( <input type="text" defaultValue={produto[field]} onBlur={(e) => handleInlineUpdate(produto.id, field, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }} autoFocus className="p-1 border rounded-md w-full bg-yellow-50 text-right text-black"/> );
        }
        return <div className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => handleCellClick(produto.id, field)}>{formatFn ? formatFn(produto[field]) : produto[field]}</div>;
    };
    
    const formatCurrency = (value) => value == null || isNaN(value) ? 'N/A' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const formatPercent = (value) => value == null || isNaN(value) ? `${Number(0).toFixed(4)}%` : `${Number(value).toFixed(4)}%`;
    const formatArea = (value) => value == null || isNaN(value) ? 'N/A' : `${Number(value).toFixed(2).replace('.', ',')} m²`;
    const SortableHeader = ({ sortKey, label, className = '' }) => { const icon = sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort; return (<th className={`px-4 py-3 text-xs font-bold uppercase ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full hover:text-gray-700">{label}<FontAwesomeIcon icon={icon} className="text-gray-400" /></button></th>); };
    
    const isMutating = sellProductMutation.isPending || deleteProductMutation.isPending || saveProductMutation.isPending || bulkUpdatePrecoM2Mutation.isPending || inlineUpdateMutation.isPending;

    return (
        <div className="space-y-4">
            <ProdutoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveFromModal} produtoToEdit={editingProduto} />
            <div className="flex flex-wrap justify-between items-end gap-4 p-4 bg-gray-50 rounded-lg border">
                <div className={`transition-all duration-300 ${selectedProdutos.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                     <label className="flex items-center gap-2 cursor-pointer mb-2"><span className="font-semibold text-gray-700 text-sm">Novo Preço/m² para {selectedProdutos.size} item(ns)</span></label>
                     <div className="flex items-center gap-2">
                         <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}} value={bulkPrecoM2} onAccept={(value) => setBulkPrecoM2(value)} className="p-2 border rounded-md shadow-sm w-48 text-black" />
                         <button onClick={handleBulkUpdate} disabled={isMutating} className="bg-purple-600 text-white px-3 py-2 rounded-md shadow-sm hover:bg-purple-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"> <FontAwesomeIcon icon={bulkUpdatePrecoM2Mutation.isPending ? faSpinner : faTasks} spin={bulkUpdatePrecoM2Mutation.isPending} /> Aplicar</button>
                     </div>
                </div>

                <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2 self-end"><FontAwesomeIcon icon={faPlus} />Adicionar Produto</button>
            </div>
            
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} checked={sortedProdutos.length > 0 && selectedProdutos.size === sortedProdutos.length} /></th>
                            <SortableHeader sortKey="unidade" label="Unidade" className="text-left" />
                            <SortableHeader sortKey="tipo" label="Tipo" className="text-left" />
                            <SortableHeader sortKey="area_m2" label="Área (m²)" className="text-right" />
                            <SortableHeader sortKey="preco_m2" label="Preço/m²" className="text-right" />
                            <SortableHeader sortKey="valor_base" label="Preço Base" className="text-right" />
                            {/* COLUNA DO FATOR REINSERIDA COM SUCESSO */}
                            <SortableHeader sortKey="fator_reajuste_percentual" label="Fator (%)" className="text-right" />
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor de Venda</th>
                            <SortableHeader sortKey="status" label="Status" className="text-center" />
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-gray-700">
                        {isMutating && sortedProdutos.length === 0 ? ( <tr><td colSpan="10" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                        ) : sortedProdutos.length > 0 ? (
                            sortedProdutos.map(produto => (
                                <tr key={produto.id} className={`hover:bg-gray-50 transition-colors ${produto.status === 'Vendido' ? 'bg-red-50 hover:bg-red-100' : produto.status === 'Reservado' ? 'bg-yellow-50 hover:bg-yellow-100' : ''} ${selectedProdutos.has(produto.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="px-4 py-2"><input type="checkbox" checked={selectedProdutos.has(produto.id)} onChange={() => handleSelectProduto(produto.id)} /></td>
                                    <td className="px-4 py-2 font-semibold">{produto.unidade}</td>
                                    <td className="px-4 py-2">{produto.tipo}</td>
                                    <td className="px-4 py-2 text-right">{formatArea(produto.area_m2)}</td>
                                    <td className="px-4 py-2 text-right font-medium text-blue-800 bg-blue-50/50">{renderEditableCell(produto, 'preco_m2', formatCurrency)}</td>
                                    <td className="px-4 py-2 text-right text-gray-600">{renderEditableCell(produto, 'valor_base', formatCurrency)}</td>
                                    <td className="px-4 py-2 text-right">{renderEditableCell(produto, 'fator_reajuste_percentual', formatPercent)}</td>
                                    <td className="px-4 py-2 text-right font-bold text-green-700 bg-green-50/30">{formatCurrency(produto.valor_venda_calculado)}</td>
                                    <td className="px-4 py-2 text-center">{renderEditableCell(produto, 'status')}</td>
                                    <td className="px-4 py-2 text-center space-x-2">
                                        {produto.status === 'Disponível' && (<button onClick={() => handleSellProduct(produto)} title="Vender esta Unidade" className="text-green-600 hover:text-green-800 transition-colors"><FontAwesomeIcon icon={faDollarSign} /></button>)}
                                        <button onClick={() => handleOpenModal(produto)} title="Editar no Modal" className="text-blue-500 hover:text-blue-700 transition-colors"><FontAwesomeIcon icon={faEdit} /></button>
                                        <button onClick={() => handleDuplicate(produto)} title="Duplicar" className="text-gray-500 hover:text-gray-700 transition-colors"><FontAwesomeIcon icon={faCopy} /></button>
                                        <button onClick={() => handleDelete(produto.id)} title="Excluir" className="text-red-500 hover:text-red-700 transition-colors"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            ))
                        ) : ( <tr><td colSpan="10" className="text-center py-10 text-gray-500">Nenhum produto cadastrado.</td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}