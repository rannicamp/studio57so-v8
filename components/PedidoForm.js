'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faPlus, faPencilAlt, faSave, faTimes, faClock } from '@fortawesome/free-solid-svg-icons';
import PedidoItemModal from './PedidoItemModal';
import KpiCard from './KpiCard'; // Usaremos o mesmo card de KPI

// Função para formatar a diferença de tempo de forma legível
const formatDuration = (milliseconds) => {
    if (milliseconds < 0 || isNaN(milliseconds)) return '0 dias';
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h`;
    return result.trim() === '' ? 'Menos de 1h' : result;
};


export default function PedidoForm({ pedidoId }) {
    const supabase = createClient();
    const [pedido, setPedido] = useState(null);
    const [itens, setItens] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingItemData, setEditingItemData] = useState(null);

    // **NOVO**: Estado para o histórico e KPIs do pedido
    const [kpis, setKpis] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Busca o pedido e também seu histórico de status
        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos_compra')
            .select(`
                *,
                solicitante:solicitante_id(nome),
                empreendimentos(nome),
                itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome), etapa:etapa_id(nome_etapa)),
                historico:pedidos_compra_status_historico(*)
            `)
            .eq('id', pedidoId)
            .single();
        
        if (pedidoError) {
            console.error(pedidoError);
            setMessage('Erro ao carregar os dados do pedido.');
            setLoading(false);
            return;
        }

        setPedido(pedidoData);
        setItens(pedidoData.itens || []);

        // **NOVO**: Cálculo dos KPIs do pedido individual
        if (pedidoData.historico) {
            const h = pedidoData.historico.sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca));
            const inicio = new Date(pedidoData.created_at);
            const cotacao = h.find(item => item.status_novo === 'Em Cotação')?.data_mudanca;
            const entrega = h.find(item => item.status_novo === 'Entregue')?.data_mudanca;
            
            const kpiResult = {
                tempoAteCotacao: cotacao ? formatDuration(new Date(cotacao) - inicio) : 'Pendente',
                tempoAteEntrega: entrega ? formatDuration(new Date(entrega) - inicio) : 'Pendente',
            };
            setKpis(kpiResult);
        }

        const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa');
        setEtapas(etapasData || []);

        setLoading(false);
    }, [pedidoId, supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    // **NOVO**: Função para salvar a data de entrega
    const handleDateChangeAndSave = async (e) => {
        const novaData = e.target.value;
        setPedido(p => ({...p, data_entrega_prevista: novaData})); // Atualiza na tela
        
        const { error } = await supabase
            .from('pedidos_compra')
            .update({ data_entrega_prevista: novaData })
            .eq('id', pedidoId);
        
        if (error) {
            setMessage(`Erro ao salvar data de entrega: ${error.message}`);
        } else {
            setMessage('Data de entrega salva com sucesso!');
        }
    };


    const handleSaveNewItem = async (newItemData) => {
        const qtd = parseFloat(newItemData.quantidade_solicitada) || 0;
        const preco = parseFloat(newItemData.preco_unitario_real) || 0;
        newItemData.custo_total_real = qtd * preco;

        const { error } = await supabase.from('pedidos_compra_itens').insert({ ...newItemData, pedido_compra_id: pedidoId });
        if (error) { setMessage('Erro ao adicionar item: ' + error.message); }
        else {
            setMessage('Item adicionado com sucesso!');
            setIsModalOpen(false);
            fetchData();
        }
    };
    
    const handleRemoveItem = async (itemId) => {
        if (!window.confirm('Tem certeza que deseja remover este item?')) return;
        const { error } = await supabase.from('pedidos_compra_itens').delete().eq('id', itemId);
        if (error) { setMessage('Erro ao remover item: ' + error.message); }
        else { setItens(prev => prev.filter(item => item.id !== itemId)); }
    };

    const handleSelectionChange = (itemId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) { newSet.delete(itemId); }
            else { newSet.add(itemId); }
            return newSet;
        });
    };

    const handleDecompose = async () => {
        if (selectedItems.size === 0) {
            alert('Selecione pelo menos um item para decompor.');
            return;
        }
    
        const itemsToMove = itens.filter(item => selectedItems.has(item.id));
        if (!confirm(`Você tem certeza que deseja criar um novo pedido com os ${itemsToMove.length} itens selecionados?`)) return;
    
        setIsSaving(true);
        setMessage('Decompondo pedido...');
    
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newPedido, error: newPedidoError } = await supabase.from('pedidos_compra').insert({
            empreendimento_id: pedido.empreendimento_id,
            solicitante_id: user.id,
            status: 'Pedido Realizado',
            justificativa: `Pedido decomposto do #${pedido.id}`
        }).select().single();
    
        if (newPedidoError) {
            setMessage('Erro ao criar novo pedido: ' + newPedidoError.message);
            setIsSaving(false);
            return;
        }
    
        const itemUpdates = itemsToMove.map(item => ({
            id: item.id,
            pedido_compra_id: newPedido.id,
            material_id: item.material_id,
            descricao_item: item.descricao_item,
            unidade_medida: item.unidade_medida,
            quantidade_solicitada: item.quantidade_solicitada,
            fornecedor_id: item.fornecedor_id,
            preco_unitario_real: item.preco_unitario_real,
            custo_total_real: item.custo_total_real,
            etapa_id: item.etapa_id
        }));
    
        const { error: updateError } = await supabase.from('pedidos_compra_itens').upsert(itemUpdates);
        
        if (updateError) {
             setMessage('Erro ao mover itens: ' + updateError.message);
             await supabase.from('pedidos_compra').delete().eq('id', newPedido.id);
        } else {
             setMessage(`Novo pedido #${newPedido.id} criado com sucesso!`);
             fetchData(); 
             setSelectedItems(new Set());
        }
        setIsSaving(false);
    };
    
    const handleEditClick = (item) => {
        setEditingItemId(item.id);
        setEditingItemData({ ...item });
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingItemData(null);
    };

    const handleEditingDataChange = (field, value) => {
        setEditingItemData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editingItemData) return;
        setIsSaving(true);
        
        const { id, quantidade_solicitada, preco_unitario_real } = editingItemData;
        
        const qtd = parseFloat(quantidade_solicitada) || 0;
        const preco = parseFloat(preco_unitario_real) || 0;
        const custo_total_real = qtd * preco;

        const { error } = await supabase
            .from('pedidos_compra_itens')
            .update({ 
                quantidade_solicitada: qtd, 
                preco_unitario_real: preco,
                custo_total_real: custo_total_real
            })
            .eq('id', id);

        if (error) {
            setMessage(`Erro ao atualizar item: ${error.message}`);
        } else {
            setMessage('Item atualizado com sucesso!');
            setEditingItemId(null);
            setEditingItemData(null);
            fetchData(); 
        }
        setIsSaving(false);
    };


    if (loading) return <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (!pedido) return <div className="text-center py-10">Pedido não encontrado.</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    return (
        <>
            <PedidoItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNewItem} etapas={etapas} />
            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <div className="border-b pb-4">
                    <h2 className="text-2xl font-bold">Solicitação de Compra #{pedido.id}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div><p><strong>Empreendimento:</strong> {pedido.empreendimentos.nome}</p></div>
                        <div><p><strong>Status:</strong> <span className="font-semibold text-blue-600">{pedido.status}</span></p></div>
                        <div>
                            <label className="font-bold">Data de Entrega Prevista:</label>
                            <input type="date" value={pedido.data_entrega_prevista || ''} onChange={handleDateChangeAndSave} className="p-1 border rounded-md ml-2"/>
                        </div>
                    </div>
                </div>

                {/* **NOVO**: Seção de KPIs do Pedido */}
                {kpis && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Indicadores do Pedido</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <KpiCard title="Tempo até Cotação" value={kpis.tempoAteCotacao} icon={faClock} color="yellow" />
                            <KpiCard title="Tempo Total de Entrega" value={kpis.tempoAteEntrega} icon={faClock} color="green" />
                         </div>
                    </div>
                )}
                
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
                            <FontAwesomeIcon icon={faPlus} /> Adicionar Item
                        </button>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedItems(new Set(itens.map(i => i.id))) : setSelectedItems(new Set())} /></th>
                                    <th className="p-2 text-left text-xs font-medium uppercase">Descrição</th>
                                    <th className="p-2 text-left text-xs font-medium uppercase">Fornecedor</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-24">Qtd.</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32">Preço Unit.</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32">Custo Total</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-28">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {itens.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-6 text-gray-500">Nenhum item adicionado.</td></tr>
                                ) : (
                                    itens.map(item => (
                                        <tr key={item.id} className={selectedItems.has(item.id) ? 'bg-blue-50' : ''}>
                                            <td className="p-2 w-10"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectionChange(item.id)} disabled={editingItemId !== null} /></td>
                                            <td className="p-2 font-medium">{item.descricao_item}</td>
                                            <td className="p-2 text-sm text-gray-600">{item.fornecedor?.nome || 'Não definido'}</td>
                                            
                                            {editingItemId === item.id ? (
                                                <>
                                                    <td className="p-2 text-center">
                                                        <input type="number" value={editingItemData.quantidade_solicitada} onChange={(e) => handleEditingDataChange('quantidade_solicitada', e.target.value)} className="w-20 p-1 border rounded-md text-center"/>
                                                    </td>
                                                    <td className="p-2 text-right">
                                                         <input type="number" step="0.01" value={editingItemData.preco_unitario_real} onChange={(e) => handleEditingDataChange('preco_unitario_real', e.target.value)} className="w-28 p-1 border rounded-md text-right"/>
                                                    </td>
                                                    <td className="p-2 text-right font-semibold">{formatCurrency((parseFloat(editingItemData.quantidade_solicitada) || 0) * (parseFloat(editingItemData.preco_unitario_real) || 0))}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2 text-center">{item.quantidade_solicitada} {item.unidade_medida}</td>
                                                    <td className="p-2 text-right">{formatCurrency(item.preco_unitario_real)}</td>
                                                    <td className="p-2 text-right font-semibold">{formatCurrency(item.custo_total_real)}</td>
                                                </>
                                            )}

                                            <td className="p-2 text-center">
                                                {editingItemId === item.id ? (
                                                    <div className="flex justify-center items-center gap-3">
                                                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800" title="Salvar"><FontAwesomeIcon icon={faSave} /></button>
                                                        <button onClick={handleCancelEdit} className="text-red-500 hover:text-red-700" title="Cancelar"><FontAwesomeIcon icon={faTimes} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center items-center gap-3">
                                                        <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800" title="Editar Item" disabled={editingItemId !== null}><FontAwesomeIcon icon={faPencilAlt} /></button>
                                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700" title="Remover Item" disabled={editingItemId !== null}><FontAwesomeIcon icon={faTrash} /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t pt-6">
                     <h3 className="text-lg font-semibold mb-2">Decompor Pedido</h3>
                     <p className="text-sm text-gray-500 mb-4">Selecione os itens na tabela acima e use o botão abaixo para movê-los para um novo pedido de compra.</p>
                     <div className="flex flex-wrap gap-4">
                         <button onClick={handleDecompose} disabled={isSaving || selectedItems.size === 0 || editingItemId !== null} className="bg-orange-500 text-white px-3 py-2 rounded-md shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2">Gerar Pedido com Itens Selecionados ({selectedItems.size})</button>
                     </div>
                </div>
                
                 {message && <div className="text-center mt-4 p-2 bg-gray-100 rounded-md text-sm">{message}</div>}
            </div>
        </>
    );
}