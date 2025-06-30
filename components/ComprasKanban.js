'use client';

import { useMemo, useState, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard';

// COLUNAS ATUALIZADAS COM O NOVO FLUXO
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
            // A lógica de agrupamento foi atualizada para usar 'Solicitação' como status inicial
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

    const handleStatusChange = async (pedidoId, newStatus) => {
        const originalPedidos = [...pedidos];
        
        // CORREÇÃO: Mapeia 'Solicitação' de volta para o valor do banco de dados ao salvar
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
            p_novo_status: statusToSave, // Usa o status corrigido
            p_usuario_id: user.id
        });

        if (rpcError) {
            alert('Erro ao registrar histórico: ' + rpcError.message);
            setPedidos(originalPedidos);
        }
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
                    className={`
                        w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm
                        transition-colors duration-300 flex flex-col
                        ${dragOverColumn === column.id ? 'bg-blue-100' : ''}
                    `}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b">
                        <h3>{column.title} ({groupedData[column.id]?.pedidos.length || 0})</h3>
                        <p className="font-bold text-green-700">{formatCurrency(groupedData[column.id]?.total)}</p>
                    </div>

                    <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
                        {groupedData[column.id] && groupedData[column.id].pedidos.map(pedido => {
                            const hasPendingInvoice = pedido.status === 'Realizado' && 
                                                      !pedido.anexos?.some(anexo => anexo.descricao === 'Nota Fiscal');
                            
                            // Mapeia o status para exibição no card
                            const displayStatus = pedido.status === 'Pedido Realizado' ? 'Solicitação' : pedido.status;

                            return (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={{...pedido, status: displayStatus}} // Passa o status mapeado
                                    onStatusChange={handleStatusChange}
                                    allStatusColumns={statusColumns.map(s => s.id)}
                                    hasPendingInvoice={hasPendingInvoice}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}