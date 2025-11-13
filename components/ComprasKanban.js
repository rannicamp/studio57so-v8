// components/ComprasKanban.js
'use client';

import { useMemo, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Definição das colunas do Kanban
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

export default function ComprasKanban({ pedidos, onCardClick }) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [draggedPedido, setDraggedPedido] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);

    // Agrupa os pedidos por status
    const columns = useMemo(() => {
        const cols = statusColumns.map(c => ({ ...c, pedidos: [] }));
        pedidos.forEach(pedido => {
            const columnIndex = cols.findIndex(c => c.id === pedido.status);
            if (columnIndex !== -1) {
                cols[columnIndex].pedidos.push(pedido);
            } else {
                // Se o status não bater com nenhuma coluna, joga na primeira (fallback) ou cria uma "Outros"
                // Por segurança, vamos ignorar ou logar, mas aqui assumimos que status são válidos.
            }
        });
        return cols;
    }, [pedidos]);

    // Mutation para atualizar o status (Ao arrastar ou clicar no menu)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ pedidoId, newStatus }) => {
            const { error } = await supabase
                .from('pedidos_compra')
                .update({ status: newStatus })
                .eq('id', pedidoId);

            if (error) throw error;
            return { pedidoId, newStatus };
        },
        onMutate: async ({ pedidoId, newStatus }) => {
            // Otimização Opcional: Poderíamos atualizar o cache localmente antes do servidor responder (Optimistic Update)
            // Mas para simplificar e evitar bugs, vamos confiar na invalidação rápida.
        },
        onSuccess: () => {
            // O PULO DO GATO: Avisa ao sistema que os dados mudaram.
            // Isso faz a page.js recarregar os dados automaticamente.
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            toast.success('Status atualizado!');
        },
        onError: (error) => {
            toast.error(`Erro ao atualizar status: ${error.message}`);
        }
    });

    // Mutation para Duplicar Pedido
    const duplicatePedidoMutation = useMutation({
        mutationFn: async (pedidoOriginal) => {
            // Prepara o objeto para cópia (removendo ID, datas, etc)
            const { id, created_at, updated_at, data_solicitacao, status, ...rest } = pedidoOriginal;
            
            const novoPedido = {
                ...rest,
                titulo: `${pedidoOriginal.titulo} (Cópia)`,
                status: 'Solicitação', // Volta para o início
                data_solicitacao: new Date().toISOString(),
                solicitante_id: user.id, // O solicitante passa a ser quem duplicou
                organizacao_id: user.organizacao_id
            };

            // 1. Cria o Pedido
            const { data: pedidoCriado, error: erroPedido } = await supabase
                .from('pedidos_compra')
                .insert(novoPedido)
                .select()
                .single();

            if (erroPedido) throw erroPedido;

            // 2. Copia os Itens (se houver)
            if (pedidoOriginal.itens && pedidoOriginal.itens.length > 0) {
                const itensParaCopiar = pedidoOriginal.itens.map(item => {
                    const { id, pedido_compra_id, created_at, ...itemRest } = item;
                    return {
                        ...itemRest,
                        pedido_compra_id: pedidoCriado.id,
                        organizacao_id: user.organizacao_id
                    };
                });

                const { error: erroItens } = await supabase
                    .from('pedidos_compra_itens')
                    .insert(itensParaCopiar);
                
                if (erroItens) console.error("Erro ao copiar itens:", erroItens); // Não trava a UI se falhar item
            }

            return pedidoCriado;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            toast.success('Pedido duplicado com sucesso!');
        },
        onError: (error) => {
            toast.error(`Erro ao duplicar: ${error.message}`);
        }
    });


    // Handlers de Drag and Drop
    const handleDragStart = (e, pedido) => {
        setDraggedPedido(pedido);
        e.dataTransfer.effectAllowed = 'move';
        // Hack para esconder a imagem fantasma padrão ou customizá-la se quisesse
        // e.dataTransfer.setDragImage(new Image(), 0, 0); 
    };

    const handleDragOver = (e, columnId) => {
        e.preventDefault(); // Necessário para permitir o drop
        setDragOverColumn(columnId);
    };

    const handleDrop = (e, targetColumnId) => {
        e.preventDefault();
        setDragOverColumn(null);

        if (!draggedPedido) return;
        if (draggedPedido.status === targetColumnId) return; // Soltou na mesma coluna

        updateStatusMutation.mutate({ 
            pedidoId: draggedPedido.id, 
            newStatus: targetColumnId 
        });
        setDraggedPedido(null);
    };

    const handleCardStatusChange = (pedidoId, newStatus) => {
        updateStatusMutation.mutate({ pedidoId, newStatus });
    };

    const handleDuplicate = (pedido) => {
        duplicatePedidoMutation.mutate(pedido);
    };

    return (
        <div className="flex overflow-x-auto pb-4 gap-4 h-full min-h-[calc(100vh-200px)]">
            {columns.map(column => (
                <div 
                    key={column.id}
                    className={`flex-shrink-0 w-80 flex flex-col rounded-lg transition-colors duration-200 ${dragOverColumn === column.id ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-100'}`}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={(e) => handleDrop(e, column.id)}
                >
                    {/* Cabeçalho da Coluna */}
                    <div className={`p-3 rounded-t-lg font-semibold text-sm flex justify-between items-center
                        ${column.id === 'Solicitação' ? 'bg-gray-200 text-gray-700' : ''}
                        ${column.id === 'Pedido Visto' ? 'bg-blue-100 text-blue-700' : ''}
                        ${column.id === 'Em Cotação' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${column.id === 'Em Negociação' ? 'bg-purple-100 text-purple-700' : ''}
                        ${column.id === 'Realizado' ? 'bg-indigo-100 text-indigo-700' : ''}
                        ${column.id === 'Entregue' ? 'bg-green-100 text-green-700' : ''}
                        ${column.id === 'Cancelado' ? 'bg-red-100 text-red-700' : ''}
                        ${!['Solicitação', 'Pedido Visto', 'Em Cotação', 'Em Negociação', 'Realizado', 'Entregue', 'Cancelado'].includes(column.id) ? 'bg-gray-200' : ''}
                    `}>
                        <span>{column.title}</span>
                        <span className="bg-white bg-opacity-50 px-2 py-0.5 rounded-full text-xs">
                            {column.pedidos.length}
                        </span>
                    </div>

                    {/* Área de Conteúdo (Cards) */}
                    <div className="p-2 flex-1 overflow-y-auto space-y-3 min-h-[100px]">
                        {column.pedidos.map(pedido => (
                            <div 
                                key={pedido.id} 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, pedido)}
                                className="cursor-move active:cursor-grabbing"
                            >
                                <PedidoCard 
                                    pedido={pedido} 
                                    onStatusChange={handleCardStatusChange}
                                    onDuplicate={() => handleDuplicate(pedido)}
                                    allStatusColumns={statusColumns.map(c => c.id)}
                                    onCardClick={onCardClick}
                                />
                            </div>
                        ))}
                        {column.pedidos.length === 0 && (
                            <div className="h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                Arraste aqui
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}