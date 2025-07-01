"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faArrowLeft, faEdit, faTrash, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import OrcamentoItemModal from './OrcamentoItemModal';

export default function OrcamentoDetalhes({ orcamento, onBack }) {
    const supabase = createClient();
    const [itens, setItens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);

    const fetchItens = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orcamento_itens')
            .select('*, etapa:etapa_id(*)')
            .eq('orcamento_id', orcamento.id)
            .order('ordem', { ascending: true, nullsFirst: true });

        if (error) {
            console.error("Erro ao buscar itens:", error);
            setMessage('Não foi possível carregar os itens.');
        } else {
            const orderedItems = (data || []).map((item, index) => ({
                ...item,
                ordem: item.ordem ?? index,
            }));
            setItens(orderedItems);
        }
        setLoading(false);
    }, [supabase, orcamento.id]);

    useEffect(() => {
        fetchItens();
    }, [fetchItens]);

    const custoTotal = useMemo(() => {
        return itens.reduce((acc, item) => acc + (item.custo_total || 0), 0);
    }, [itens]);

    const groupedItems = useMemo(() => {
        const groups = new Map();
        itens.forEach(item => {
            const etapa = item.etapa;
            const etapaKey = etapa ? `${etapa.codigo_etapa || '99'}-${etapa.nome_etapa}` : '99-Sem Etapa Definida';
            
            if (!groups.has(etapaKey)) {
                groups.set(etapaKey, {
                    codigo: etapa?.codigo_etapa || '',
                    nome: etapa?.nome_etapa || 'Sem Etapa Definida',
                    total: 0,
                    items: []
                });
            }
            const group = groups.get(etapaKey);
            group.items.push(item);
            group.total += (item.custo_total || 0);
        });

        return Array.from(groups.entries())
            .map(([key, data]) => ({ key, ...data }))
            .sort((a, b) => a.key.localeCompare(b.key));

    }, [itens]);

    const handleOpenModal = (item = null) => { setEditingItem(item); setIsModalOpen(true); };
    const handleCloseModal = () => { setEditingItem(null); setIsModalOpen(false); };
    const handleSaveItem = () => { fetchItens(); };

    const handleDeleteItem = async (itemId) => {
        if (window.confirm('Tem certeza que deseja excluir este item?')) {
            const { error } = await supabase.from('orcamento_itens').delete().eq('id', itemId);
            if (error) setMessage(`Erro ao excluir: ${error.message}`);
            else { setMessage('Item excluído.'); fetchItens(); }
        }
    };
    
    const handleDragStart = (e, item) => {
        setDraggedItem(item);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, targetItem) => {
        if (!draggedItem || draggedItem.id === targetItem.id || draggedItem.etapa_id !== targetItem.etapa_id) {
            setDraggedItem(null);
            return;
        }
    
        const itemsDaMesmaEtapa = itens.filter(i => i.etapa_id === draggedItem.etapa_id);
        const currentIndex = itemsDaMesmaEtapa.findIndex(i => i.id === draggedItem.id);
        const targetIndex = itemsDaMesmaEtapa.findIndex(i => i.id === targetItem.id);
    
        itemsDaMesmaEtapa.splice(currentIndex, 1);
        itemsDaMesmaEtapa.splice(targetIndex, 0, draggedItem);
    
        const outrosItens = itens.filter(i => i.etapa_id !== draggedItem.etapa_id);
        setItens([...outrosItens, ...itemsDaMesmaEtapa]);
    
        const updates = itemsDaMesmaEtapa.map((item, index) => ({
            id: item.id,
            ordem: index,
        }));
    
        const { error } = await supabase.rpc('reordenar_orcamento_itens', {
            itens_para_atualizar: updates
        });
    
        if (error) {
            setMessage('Erro ao salvar a nova ordem.');
            console.error(error);
            fetchItens(); 
        }
    
        setDraggedItem(null);
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const formatPercentage = (value) => {
        if (!custoTotal || custoTotal === 0) {
            return '0.00%';
        }
        const percentage = (value / custoTotal) * 100;
        return `${percentage.toFixed(2)}%`;
    };

    return (
        <>
            <OrcamentoItemModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveItem} orcamentoId={orcamento.id} itemToEdit={editingItem} />
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2"> <FontAwesomeIcon icon={faArrowLeft} /> Voltar </button>
                        <h2 className="text-2xl font-bold text-gray-800">{orcamento.nome_orcamento}</h2>
                        <p className="text-sm text-gray-500">Versão {orcamento.versao} - Status: {orcamento.status}</p>
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 flex items-center gap-2"> <FontAwesomeIcon icon={faPlus} /> Adicionar Item </button>
                </div>

                {message && <p className="text-center font-medium text-sm p-2 bg-green-50 text-green-700 rounded-md">{message}</p>}

                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-3 w-10"></th>
                                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase w-16">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Un.</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Qtd.</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Preço Unit.</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Custo Total</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">% do Total</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan="9" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                            ) : groupedItems.length === 0 ? (
                                <tr><td colSpan="9" className="text-center py-10 text-gray-500">Nenhum item adicionado.</td></tr>
                            ) : (
                                groupedItems.map(group => (
                                    <Fragment key={group.key}>
                                        {/* ***** INÍCIO DA CORREÇÃO ***** */}
                                        <tr className="bg-gray-100 font-semibold text-gray-800">
                                            <td colSpan="6" className="px-6 py-3 border-t-2 border-gray-200"> {group.codigo} - {group.nome} </td>
                                            <td className="px-6 py-3 text-right border-t-2 border-gray-200"> {formatCurrency(group.total)} </td>
                                            <td className="px-6 py-3 text-right border-t-2 border-gray-200 font-bold text-blue-700"> {formatPercentage(group.total)} </td>
                                            <td className="px-6 py-3 border-t-2 border-gray-200"></td>
                                        </tr>
                                        {/* ***** FIM DA CORREÇÃO ***** */}
                                        {group.items.map((item, index) => (
                                            <tr key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item)} className="hover:bg-gray-50 cursor-grab">
                                                <td className="px-2 py-4 text-center text-gray-400"><FontAwesomeIcon icon={faGripVertical} /></td>
                                                <td className="px-2 py-4 text-sm text-gray-700">{group.codigo}.{index + 1}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.descricao}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.unidade}</td>
                                                <td className="px-6 py-4 text-sm text-center text-gray-600">{item.quantidade}</td>
                                                <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(item.preco_unitario)}</td>
                                                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-800">{formatCurrency(item.custo_total)}</td>
                                                <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td>
                                                <td className="px-6 py-4 text-sm text-center space-x-4">
                                                    <button onClick={() => handleOpenModal(item)} title="Editar Item" className="text-blue-500 hover:text-blue-700"> <FontAwesomeIcon icon={faEdit} /> </button>
                                                    <button onClick={() => handleDeleteItem(item.id)} title="Excluir Item" className="text-red-500 hover:text-red-700"> <FontAwesomeIcon icon={faTrash} /> </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-100">
                            <tr>
                                <td colSpan="8" className="px-6 py-3 text-right text-sm font-bold text-gray-700 uppercase">Custo Total Previsto:</td>
                                <td className="px-6 py-3 text-right text-base font-bold text-gray-900">{formatCurrency(custoTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}