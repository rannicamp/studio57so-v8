'use client';

import { useMemo, useState } from 'react';
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

    const groupedPedidos = useMemo(() => {
        const groups = {};
        statusColumns.forEach(col => groups[col.id] = []);
        pedidos.forEach(p => {
            if (groups[p.status]) {
                groups[p.status].push(p);
            }
        });
        return groups;
    }, [pedidos]);

    const handleStatusChange = async (pedidoId, newStatus) => {
        const originalPedidos = [...pedidos];
        const updatedPedidos = pedidos.map(p => p.id === pedidoId ? { ...p, status: newStatus } : p);
        setPedidos(updatedPedidos);

        const { error } = await supabase
            .from('pedidos_compra')
            .update({ status: newStatus })
            .eq('id', pedidoId);

        if (error) {
            alert('Erro ao atualizar status: ' + error.message);
            setPedidos(originalPedidos);
        }
    };

    // --- Funções para o Drag and Drop ---

    // Permite que a coluna seja uma área válida para soltar
    const handleDragOver = (e, columnId) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };

    // Lida com o evento de soltar o card na coluna
    const handleDrop = (e, newStatus) => {
        e.preventDefault();
        const pedidoId = parseInt(e.dataTransfer.getData('pedidoId'), 10);
        setDragOverColumn(null); // Limpa o efeito visual
        
        // Verifica se o ID do pedido é válido e se o status mudou
        if (pedidoId && pedidos.find(p => p.id === pedidoId)?.status !== newStatus) {
            handleStatusChange(pedidoId, newStatus);
        }
    };

    return (
        <div className="flex gap-4 overflow-x-auto p-2">
            {statusColumns.map(column => (
                <div 
                    key={column.id} 
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={(e) => handleDrop(e, column.id)}
                    onDragLeave={() => setDragOverColumn(null)}
                    className={`
                        w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm
                        transition-colors duration-300
                        ${dragOverColumn === column.id ? 'bg-blue-100' : ''}
                    `}
                >
                    <h3 className="p-3 text-sm font-semibold text-gray-700 border-b">{column.title} ({groupedPedidos[column.id]?.length || 0})</h3>
                    <div className="p-2 space-y-3 min-h-[100px]">
                        {groupedPedidos[column.id] && groupedPedidos[column.id].map(pedido => (
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