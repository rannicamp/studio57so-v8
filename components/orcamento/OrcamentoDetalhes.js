"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faArrowLeft, faEdit, faTrash, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import OrcamentoItemModal from './OrcamentoItemModal';
import { toast } from 'sonner';

export default function OrcamentoDetalhes({ orcamento, onBack }) {
    const supabase = createClient();
    const [itens, setItens] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);

    const fetchItens = useCallback(async () => {
        if (!orcamento?.id || !orcamento?.organizacao_id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('orcamento_itens')
            .select('*, etapa:etapa_id(*), subetapa:subetapa_id(*)')
            .eq('orcamento_id', orcamento.id)
            .eq('organizacao_id', orcamento.organizacao_id) // Por que: Garante que só itens da organização correta sejam carregados.
            .order('ordem', { ascending: true, nullsFirst: true });

        if (error) { 
            console.error("Erro:", error); 
            toast.error('Não foi possível carregar os itens do orçamento.');
        } else { 
            setItens((data || []).map((item, index) => ({ ...item, ordem: item.ordem ?? index }))); 
        }
        setLoading(false);
    }, [supabase, orcamento]);

    const fetchEtapas = useCallback(async () => {
        if (!orcamento?.organizacao_id) return;
        // Por que: Filtra as etapas de obra pela organização, para que o usuário veja apenas as opções relevantes.
        const { data } = await supabase
            .from('etapa_obra')
            .select('id, nome_etapa, codigo_etapa')
            .eq('organizacao_id', orcamento.organizacao_id)
            .order('codigo_etapa');
        setEtapas(data || []);
    }, [supabase, orcamento]);

    useEffect(() => { fetchItens(); fetchEtapas(); }, [fetchItens, fetchEtapas]);

    const custoTotal = useMemo(() => itens.reduce((acc, item) => acc + (item.custo_total || 0), 0), [itens]);
    
    const groupedItems = useMemo(() => {
        // A lógica de agrupamento permanece a mesma
        const groups = new Map();
        itens.forEach(item => {
            const etapa = item.etapa;
            const subetapa = item.subetapa;
            const etapaKey = etapa ? `${etapa.codigo_etapa || '99'}-${etapa.nome_etapa}` : '99-Sem Etapa Definida';
            const subetapaKey = subetapa ? `${subetapa.id}-${subetapa.nome_subetapa}` : '0-Itens sem Subetapa';

            if (!groups.has(etapaKey)) {
                groups.set(etapaKey, {
                    codigo: etapa?.codigo_etapa?.split('.')[0] || '99',
                    nome: etapa?.nome_etapa || 'Sem Etapa Definida',
                    total: 0,
                    subgrupos: new Map()
                });
            }
            const etapaGroup = groups.get(etapaKey);

            if (!etapaGroup.subgrupos.has(subetapaKey)) {
                etapaGroup.subgrupos.set(subetapaKey, {
                    nome: subetapa?.nome_subetapa || 'Itens sem Subetapa',
                    isRealSubetapa: !!subetapa,
                    total: 0,
                    items: []
                });
            }
            const subetapaGroup = etapaGroup.subgrupos.get(subetapaKey);

            subetapaGroup.items.push(item);
            subetapaGroup.total += (item.custo_total || 0);
            etapaGroup.total += (item.custo_total || 0);
        });

        return Array.from(groups.entries()).map(([key, etapaData]) => ({
            key,
            ...etapaData,
            subgrupos: Array.from(etapaData.subgrupos.entries())
                .map(([subKey, subData]) => ({ key: subKey, ...subData }))
                .sort((a, b) => a.key.localeCompare(b.key))
        })).sort((a, b) => a.key.localeCompare(b.key));

    }, [itens]);

    const handleSaveItem = async (formData) => {
        const orgId = orcamento.organizacao_id;
        if (!orgId) {
            toast.error("Orçamento sem organização definida. Não é possível salvar.");
            return false;
        }

        const isEditing = Boolean(formData.id);
        let success = false;
        const promise = async () => {
            let materialId = formData.material_id;
            if (!materialId && formData.descricao) {
                // Por que: Se um novo material for criado, ele já é inserido com a organização correta.
                const { data: newMaterial, error: materialError } = await supabase.from('materiais').insert({ 
                    descricao: formData.descricao, 
                    unidade_medida: formData.unidade, 
                    Grupo: formData.categoria, 
                    preco_unitario: formData.preco_unitario || null, 
                    Origem: 'Manual',
                    organizacao_id: orgId
                }).select('id').single();
                if (materialError) throw new Error(`Erro ao criar novo material: ${materialError.message}`);
                materialId = newMaterial.id;
            }

            const itemParaSalvar = {
                orcamento_id: orcamento.id, material_id: materialId, descricao: formData.descricao, unidade: formData.unidade, quantidade: formData.quantidade, preco_unitario: formData.preco_unitario || null, categoria: formData.categoria, etapa_id: formData.etapa_id || null, subetapa_id: formData.subetapa_id || null,
                organizacao_id: orgId // Por que: Garantimos que o item do orçamento pertence à organização correta.
            };
            
            if (isEditing) {
                const { error } = await supabase.from('orcamento_itens').update(itemParaSalvar).eq('id', formData.id).eq('organizacao_id', orgId);
                if (error) throw error;
            } else {
                itemParaSalvar.ordem = itens.length;
                const { error } = await supabase.from('orcamento_itens').insert(itemParaSalvar);
                if (error) throw error;
            }
        };

        await toast.promise(promise(), {
            loading: 'Salvando item...',
            success: () => {
                fetchItens();
                success = true;
                return `Item ${isEditing ? 'atualizado' : 'criado'} com sucesso!`;
            },
            error: (err) => err.message
        });

        return success;
    };
    
    const handleOpenModal = (item = null) => { setEditingItem(item); setIsModalOpen(true); };
    const handleCloseModal = () => { setEditingItem(null); setIsModalOpen(false); };
    
    const handleDeleteItem = async (itemId) => {
        const orgId = orcamento.organizacao_id;
        const promise = async () => {
            if (!orgId) throw new Error("Organização não identificada.");
            // Por que: Adicionamos o filtro de organização para garantir que a exclusão seja segura.
            const { error } = await supabase.from('orcamento_itens').delete().eq('id', itemId).eq('organizacao_id', orgId);
            if (error) throw error;
        };

        toast.warning("Tem certeza que deseja excluir este item?", {
            action: {
                label: "Excluir",
                onClick: () => toast.promise(promise(), {
                    loading: 'Excluindo item...',
                    success: () => { fetchItens(); return 'Item excluído com sucesso!'; },
                    error: (err) => `Erro: ${err.message}`
                })
            },
            cancel: {
                label: "Cancelar"
            }
        });
    };
    
    const handleDragStart = (e, item) => { setDraggedItem(item); };
    const handleDragOver = (e) => { e.preventDefault(); };
    const handleDrop = async (e, targetItem) => {
        if (!draggedItem || draggedItem.id === targetItem.id || draggedItem.etapa_id !== targetItem.etapa_id || draggedItem.subetapa_id !== targetItem.subetapa_id) { 
            setDraggedItem(null); 
            return; 
        }
        const itemsRelevantes = itens.filter(i => i.etapa_id === draggedItem.etapa_id && i.subetapa_id === draggedItem.subetapa_id);
        const currentIndex = itemsRelevantes.findIndex(i => i.id === draggedItem.id);
        const targetIndex = itemsRelevantes.findIndex(i => i.id === targetItem.id);
        itemsRelevantes.splice(currentIndex, 1);
        itemsRelevantes.splice(targetIndex, 0, draggedItem);
        const outrosItens = itens.filter(i => !(i.etapa_id === draggedItem.etapa_id && i.subetapa_id === draggedItem.subetapa_id));
        
        const todosItensOrdenados = [...outrosItens, ...itemsRelevantes];
        setItens(todosItensOrdenados); // Atualização otimista da UI
        
        const updates = todosItensOrdenados.map((item, index) => ({ id: item.id, ordem: index }));
        
        const { error } = await supabase.rpc('reordenar_orcamento_itens', { itens_para_atualizar: updates });
        if (error) { 
            toast.error('Erro ao salvar a nova ordem. Atualizando a lista...'); 
            fetchItens(); // Reverte para o estado do banco em caso de erro
        }
        setDraggedItem(null);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatPercentage = (value) => { if (!custoTotal || custoTotal === 0) return '0.00%'; return `${((value / custoTotal) * 100).toFixed(2)}%`; };

    return (
        <>
            <OrcamentoItemModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveItem} orcamentoId={orcamento.id} itemToEdit={editingItem} etapas={etapas} />
            <div className="space-y-6">
                <div className="sticky top-16 z-20 bg-white py-4 flex justify-between items-center mb-4 border-b border-gray-200">
                    <div>
                        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faArrowLeft} /> Voltar
                        </button>
                        <h2 className="text-2xl font-bold">{orcamento.nome_orcamento}</h2>
                        <p className="text-sm text-gray-500">Versão {orcamento.versao} - Status: {orcamento.status}</p>
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPlus} /> Adicionar Item
                    </button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr><th className="px-2 py-3 w-10"></th><th className="px-2 py-3 text-left text-xs font-bold uppercase w-24">Item</th><th className="px-6 py-3 text-left text-xs font-bold uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs font-bold uppercase">Un.</th><th className="px-6 py-3 text-center text-xs font-bold uppercase">Qtd.</th><th className="px-6 py-3 text-right text-xs font-bold uppercase">Preço Unit.</th><th className="px-6 py-3 text-right text-xs font-bold uppercase">Custo Total</th><th className="px-6 py-3 text-right text-xs font-bold uppercase">% do Total</th><th className="px-6 py-3 text-center text-xs font-bold uppercase">Ações</th></tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">{
                            loading ? (<tr><td colSpan="9" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>)
                            : groupedItems.length === 0 ? (<tr><td colSpan="9" className="text-center py-10">Nenhum item adicionado.</td></tr>)
                            : (groupedItems.map(group => {
                                let runningIndex = 0;
                                return (
                                    <Fragment key={group.key}>
                                        <tr className="bg-gray-200 font-bold"><td colSpan="6" className="px-6 py-3 border-t-4 border-gray-300"> {group.codigo} - {group.nome} </td><td className="px-6 py-3 text-right border-t-4 border-gray-300">{formatCurrency(group.total)}</td><td className="px-6 py-3 text-right border-t-4 border-gray-300 text-blue-700">{formatPercentage(group.total)}</td><td className="px-6 py-3 border-t-4 border-gray-300"></td></tr>
                                        {group.subgrupos.map(subgroup => {
                                            if (subgroup.isRealSubetapa) {
                                                runningIndex++;
                                                const subetapaNumber = runningIndex;
                                                return (
                                                    <Fragment key={subgroup.key}>
                                                        <tr className="bg-gray-100 font-semibold"><td colSpan="6" className="pl-12 pr-6 py-2"> {group.codigo}.{subetapaNumber} - {subgroup.nome} </td><td className="px-6 py-2 text-right">{formatCurrency(subgroup.total)}</td><td className="px-6 py-2 text-right text-blue-600">{formatPercentage(subgroup.total)}</td><td></td></tr>
                                                        {subgroup.items.map((item, itemIndex) => (
                                                            <tr key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item)} className="hover:bg-gray-50 cursor-grab">
                                                                <td className="px-2 py-4 text-center text-gray-400"><FontAwesomeIcon icon={faGripVertical} /></td>
                                                                <td className="px-2 py-4 text-sm font-mono">{`${group.codigo}.${subetapaNumber}.${itemIndex + 1}`}</td>
                                                                <td className="px-6 py-4 text-sm">{item.descricao}</td><td className="px-6 py-4 text-sm">{item.unidade}</td><td className="px-6 py-4 text-sm text-center">{item.quantidade}</td><td className="px-6 py-4 text-sm text-right">{formatCurrency(item.preco_unitario)}</td><td className="px-6 py-4 text-sm text-right font-semibold">{formatCurrency(item.custo_total)}</td><td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td><td className="px-6 py-4 text-sm text-center space-x-4"><button onClick={() => handleOpenModal(item)} title="Editar" className="text-blue-500"><FontAwesomeIcon icon={faEdit} /></button><button onClick={() => handleDeleteItem(item.id)} title="Excluir" className="text-red-500"><FontAwesomeIcon icon={faTrash} /></button></td>
                                                            </tr>
                                                        ))}
                                                    </Fragment>
                                                );
                                            } else {
                                                return (
                                                    <Fragment key={subgroup.key}>
                                                        {subgroup.items.map(item => {
                                                            runningIndex++;
                                                            return (
                                                                <tr key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item)} className="hover:bg-gray-50 cursor-grab">
                                                                    <td className="px-2 py-4 text-center text-gray-400"><FontAwesomeIcon icon={faGripVertical} /></td>
                                                                    <td className="px-2 py-4 text-sm font-mono">{`${group.codigo}.${runningIndex}`}</td>
                                                                    <td className="px-6 py-4 text-sm">{item.descricao}</td><td className="px-6 py-4 text-sm">{item.unidade}</td><td className="px-6 py-4 text-sm text-center">{item.quantidade}</td><td className="px-6 py-4 text-sm text-right">{formatCurrency(item.preco_unitario)}</td><td className="px-6 py-4 text-sm text-right font-semibold">{formatCurrency(item.custo_total)}</td><td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td><td className="px-6 py-4 text-sm text-center space-x-4"><button onClick={() => handleOpenModal(item)} title="Editar" className="text-blue-500"><FontAwesomeIcon icon={faEdit} /></button><button onClick={() => handleDeleteItem(item.id)} title="Excluir" className="text-red-500"><FontAwesomeIcon icon={faTrash} /></button></td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </Fragment>
                                                );
                                            }
                                        })}
                                    </Fragment>
                                );
                            }))}
                        </tbody>
                        <tfoot className="bg-gray-100"><tr><td colSpan="8" className="px-6 py-3 text-right text-sm font-bold uppercase">Custo Total Previsto:</td><td className="px-6 py-3 text-right text-base font-bold">{formatCurrency(custoTotal)}</td></tr></tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}