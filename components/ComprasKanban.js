'use client';

import { useMemo, useState, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard';

const statusColumns = [
    { id: 'Pedido Realizado', title: 'Pedido Realizado' },
    { id: 'Pedido Visto', title: 'Pedido Visto' },
    { id: 'Em Cotação', title: 'Em Cotação' },
    { id: 'Em Negociação', title: 'Em Negociação' },
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
        // **A CORREÇÃO ESTÁ AQUI**:
        // Agora a verificação procura pela classe específica 'kanban-card'.
        // Isso impede que o clique arraste a tela apenas quando se clica em um card,
        // liberando o arraste para todo o resto da área.
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
            if (groups[p.status]) {
                groups[p.status].pedidos.push(p);
                const pedidoTotal = p.itens?.reduce((sum, item) => sum + (item.custo_total_real || 0), 0) || 0;
                groups[p.status].total += pedidoTotal;
            }
        });
        return groups;
    }, [pedidos]);

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const handleStatusChange = async (pedidoId, newStatus) => {
        const originalPedidos = [...pedidos];
        const updatedPedidos = pedidos.map(p => p.id === pedidoId ? { ...p, status: newStatus } : p);
        setPedidos(updatedPedidos);

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase.rpc('atualizar_status_pedido', {
            p_pedido_id: pedidoId,
            p_novo_status: newStatus,
            p_usuario_id: user.id
        });

        if (error) {
            alert('Erro ao atualizar status: ' + error.message);
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
        
        if (pedidoId && pedidos.find(p => p.id === pedidoId)?.status !== newStatus) {
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
                        {groupedData[column.id] && groupedData[column.id].pedidos.map(pedido => (
                            <PedidoCard
                                key={pedido.id}
                                pedido={pedido}
                                onStatusChange={handleStatusChange}
                                allStatusColumns={statusColumns.map(s => s.id)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}