'use client';

import { useMemo, useState, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard';
import { toast } from 'sonner'; // Importar toast para feedback
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faBroom } from '@fortawesome/free-solid-svg-icons'; // Importar faTrash ou faBroom

const statusColumns = [
    { id: 'Solicitação', title: 'Solicitação' },
    { id: 'Pedido Visto', title: 'Pedido Visto' },
    { id: 'Em Cotação', title: 'Em Cotação' },
    { id: 'Em Negociação', title: 'Em Negociação' },
    { id: 'Revisão do Responsável', title: 'Revisão do Responsável' },
    { id: 'Realizado', title: 'Realizado (Aguardando Entrega)' },
    { id: 'Entregue', title: 'Entregue' },
    { id: 'Cancelado', title: 'Cancelado' },
];

export default function ComprasKanban({ pedidos, setPedidos }) {
    const supabase = createClient();
    const [dragOverColumn, setDragOverColumn] = useState(null);
    const scrollContainerRef = useRef(null);
    
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isDeletingCanceled, setIsDeletingCanceled] = useState(false); // Novo estado para o botão de exclusão

    const handleMouseDown = (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('button')) {
            return;
        }
        setIsDragging(true);
        const container = scrollContainerRef.current;
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
    };

    const handleMouseLeaveOrUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const container = scrollContainerRef.current;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX); 
        container.scrollLeft = scrollLeft - walk;
    };

    const groupedData = useMemo(() => {
        const groups = {};
        statusColumns.forEach(col => {
            groups[col.id] = { pedidos: [], total: 0 };
        });

        pedidos.forEach(p => {
            const currentStatus = p.status === 'Pedido Realizado' ? 'Solicitação' : p.status;
            if (groups[currentStatus]) {
                groups[currentStatus].pedidos.push(p);
                const pedidoTotal = p.itens?.reduce((sum, item) => sum + (item.custo_total_real || 0), 0) || 0;
                groups[currentStatus].total += pedidoTotal;
            }
        });
        return groups;
    }, [pedidos]);

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    
    const checkPendingItems = (pedido) => {
        if (!pedido || !pedido.itens || pedido.itens.length === 0) return true;
        return pedido.itens.some(item => 
            !item.preco_unitario_real || item.preco_unitario_real <= 0 || !item.fornecedor_id
        );
    };

    const handleDuplicatePedido = async (pedidoId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Você precisa estar logado para duplicar um pedido.');
            return;
        }
        
        const { data: newPedido, error } = await supabase
            .rpc('duplicar_pedido_compra', {
                p_original_pedido_id: pedidoId,
                p_novo_solicitante_id: user.id
            })
            .select('*, solicitante:solicitante_id(id, nome), itens:pedidos_compra_itens(*), anexos:pedidos_compra_anexos(*)')
            .single();

        if (error) {
            alert('Erro ao duplicar o pedido: ' + error.message);
        } else {
            alert(`Pedido #${pedidoId} duplicado com sucesso! Novo pedido gerado: #${newPedido.id}`);
            setPedidos(prevPedidos => [newPedido, ...prevPedidos]);
        }
    };

    const handleStatusChange = async (pedidoId, newStatus) => {
        const originalPedidos = [...pedidos];
        const pedido = originalPedidos.find(p => p.id === pedidoId);

        if (newStatus === 'Realizado' && checkPendingItems(pedido)) {
            alert('Ação bloqueada: Não é possível mover para "Realizado".\n\nTodos os itens do pedido devem ter um Fornecedor e um Preço Unitário definidos.');
            setDragOverColumn(null);
            return;
        }
        
        const statusToSave = newStatus === 'Solicitação' ? 'Pedido Realizado' : newStatus;

        const { data: updatedPedido, error: updateError } = await supabase
            .from('pedidos_compra')
            .update({ status: statusToSave })
            .eq('id', pedidoId)
            .select('*, solicitante:solicitante_id(id, nome), itens:pedidos_compra_itens(*), anexos:pedidos_compra_anexos(*)')
            .single();

        if (updateError) {
             alert('Erro ao atualizar status: ' + updateError.message);
             setPedidos(originalPedidos);
             return;
        }

        const updatedPedidos = pedidos.map(p => p.id === pedidoId ? updatedPedido : p);
        setPedidos(updatedPedidos);

        const { data: { user } } = await supabase.auth.getUser();

        const { error: rpcError } = await supabase.rpc('atualizar_status_pedido', {
            p_pedido_id: pedidoId,
            p_novo_status: statusToSave,
            p_usuario_id: user.id
        });

        if (rpcError) {
            alert('Erro ao registrar histórico: ' + rpcError.message);
            setPedidos(originalPedidos);
        }
    };

    // NOVA FUNÇÃO: Excluir todos os pedidos cancelados
    const handleDeleteAllCanceled = async () => {
        const canceledPedidosCount = groupedData['Cancelado']?.pedidos.length || 0;

        if (canceledPedidosCount === 0) {
            toast.info('Não há pedidos cancelados para excluir.');
            return;
        }

        if (!window.confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE TODOS os ${canceledPedidosCount} pedidos cancelados? Esta ação é irreversível!`)) {
            return;
        }

        setIsDeletingCanceled(true);
        
        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error } = await supabase
                    .from('pedidos_compra')
                    .delete()
                    .eq('status', 'Cancelado'); // Exclui pedidos com status 'Cancelado'

                if (error) {
                    reject(new Error(`Erro ao excluir pedidos cancelados: ${error.message}`));
                } else {
                    resolve(`Todos os ${canceledPedidosCount} pedidos cancelados foram excluídos com sucesso!`);
                }
            }),
            {
                loading: 'Excluindo pedidos cancelados...',
                success: (msg) => { 
                    setPedidos(prev => prev.filter(p => p.status !== 'Cancelado')); // Remove os pedidos cancelados do estado
                    return msg; 
                },
                error: (err) => err.message,
                finally: () => setIsDeletingCanceled(false)
            }
        );
    };

    const handleDragOver = (e, columnId) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };

    const handleDrop = (e, newStatus) => {
        e.preventDefault();
        const pedidoId = parseInt(e.dataTransfer.getData('pedidoId'), 10);
        setDragOverColumn(null);
        
        const currentStatus = pedidos.find(p => p.id === pedidoId)?.status;
        const mappedCurrentStatus = currentStatus === 'Pedido Realizado' ? 'Solicitação' : currentStatus;

        if (pedidoId && mappedCurrentStatus !== newStatus) {
            handleStatusChange(pedidoId, newStatus);
        }
    };

    return (
        <div 
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto p-2 cursor-grab"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
        >
            {statusColumns.map(column => (
                <div 
                    key={column.id} 
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={(e) => handleDrop(e, column.id)}
                    onDragLeave={() => setDragOverColumn(null)}
                    className={`w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm transition-colors duration-300 flex flex-col ${dragOverColumn === column.id ? 'bg-blue-100' : ''}`}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b flex justify-between items-center"> {/* Adicionado flex para alinhamento */}
                        <h3>{column.title} ({groupedData[column.id]?.pedidos.length || 0})</h3>
                        {/* NOVO BOTÃO DE EXCLUIR PEDIDOS CANCELADOS EM MASSA */}
                        {column.id === 'Cancelado' && groupedData[column.id]?.pedidos.length > 0 && (
                            <button
                                onClick={handleDeleteAllCanceled}
                                disabled={isDeletingCanceled}
                                className="bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                                title="Excluir todos os pedidos cancelados"
                            >
                                {isDeletingCanceled ? (
                                    <FontAwesomeIcon icon={faSpinner} spin size="sm" />
                                ) : (
                                    <FontAwesomeIcon icon={faTrash} size="sm" />
                                )}
                            </button>
                        )}
                    </div>
                    <p className="font-bold text-green-700 px-3">{formatCurrency(groupedData[column.id]?.total)}</p>

                    <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
                        {groupedData[column.id] && groupedData[column.id].pedidos.map(pedido => {
                            const hasPendingInvoice = pedido.status === 'Realizado' && !pedido.anexos?.some(anexo => anexo.descricao === 'Nota Fiscal');
                            const displayStatus = pedido.status === 'Pedido Realizado' ? 'Solicitação' : pedido.status;
                            const hasPendingItems = ['Em Negociação', 'Revisão do Responsável'].includes(displayStatus) && checkPendingItems(pedido);
                            
                            return (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={{...pedido, status: displayStatus}}
                                    onStatusChange={handleStatusChange}
                                    onDuplicate={handleDuplicatePedido}
                                    allStatusColumns={statusColumns.map(s => s.id)}
                                    hasPendingInvoice={hasPendingInvoice}
                                    hasPendingItems={hasPendingItems}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}