// components/ComprasKanban.js
"use client";

import { useMemo, useState, useRef, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
// 1. IMPORTAÇÃO DA NOTIFICAÇÃO 🔔
import { notificarGrupo } from '@/utils/notificacoes';

// Definição das colunas do Kanban (Fluxo Fixo)
const statusColumns = [
    { id: 'Solicitação', title: 'Solicitação' },
    { id: 'Pedido Visto', title: 'Pedido Visto' },
    { id: 'Em Cotação', title: 'Em Cotação' },
    { id: 'Em Negociação', title: 'Em Negociação' },
    { id: 'Revisão do Responsável', title: 'Revisão do Responsável' },
    { id: 'Realizado', title: 'Realizado' },
    { id: 'Entregue', title: 'Entregue' },
    { id: 'Cancelado', title: 'Cancelado' },
];

export default function ComprasKanban({ 
    pedidos, 
    onCardClick,
    onDeleteAllCanceled, 
    canDelete,           
    isDeleting           
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const [draggedPedido, setDraggedPedido] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);
    const [sorting, setSorting] = useState({});
    const [openSortMenu, setOpenSortMenu] = useState(null);
    const sortMenuRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [isDraggingScroll, setIsDraggingScroll] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    
    // Estado para controlar o spinner da lixeira
    const [deletingColumnId, setDeletingColumnId] = useState(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
                setOpenSortMenu(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [sortMenuRef]);

    useEffect(() => {
        if (!isDeleting) {
            setDeletingColumnId(null);
        }
    }, [isDeleting]);

    // Mutation para atualizar o status (Drag-n-drop)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ pedidoId, newStatus }) => {
            const { error } = await supabase
                .from('pedidos_compra')
                .update({ status: newStatus })
                .eq('id', pedidoId);
            if (error) throw error;
            return { pedidoId, newStatus };
        },
        onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            toast.success('Status atualizado!');

            // 2. LÓGICA DE NOTIFICAÇÃO DE ENTREGA 🚚✅
            if (result.newStatus === 'Entregue') {
                // Encontramos o pedido na lista local para pegar o título (mais rápido que buscar no banco)
                const pedidoInfo = pedidos.find(p => p.id === result.pedidoId);
                const tituloPedido = pedidoInfo?.titulo || 'Pedido sem título';

                await notificarGrupo({
                    permissao: 'pedidos', // Avisa quem tem acesso a compras
                    titulo: '✅ Entrega Confirmada!',
                    mensagem: `O Pedido #${result.pedidoId} (${tituloPedido}) foi marcado como Entregue na obra.`,
                    link: `/pedidos/${result.pedidoId}`,
                    tipo: 'sucesso', // Ícone verde de sucesso
                    organizacaoId: user.organizacao_id
                });
            }
        },
        onError: (error) => toast.error(`Erro ao atualizar status: ${error.message}`)
    });

    // Mutation para Duplicar
    const duplicatePedidoMutation = useMutation({
        mutationFn: async (pedidoOriginal) => {
            const { id, created_at, updated_at, data_solicitacao, status, ...rest } = pedidoOriginal;
            const novoPedido = {
                ...rest,
                titulo: `${pedidoOriginal.titulo} (Cópia)`,
                status: 'Solicitação',
                data_solicitacao: new Date().toISOString(),
                solicitante_id: user.id,
                organizacao_id: user.organizacao_id
            };

            const { data: pedidoCriado, error: erroPedido } = await supabase
                .from('pedidos_compra')
                .insert(novoPedido)
                .select()
                .single();
            if (erroPedido) throw erroPedido;

            if (pedidoOriginal.itens && pedidoOriginal.itens.length > 0) {
                const itensParaCopiar = pedidoOriginal.itens.map(item => {
                    const { id, pedido_compra_id, created_at, ...itemRest } = item;
                    return { ...itemRest, pedido_compra_id: pedidoCriado.id, organizacao_id: user.organizacao_id };
                });
                await supabase.from('pedidos_compra_itens').insert(itensParaCopiar);
            }
            return pedidoCriado;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            toast.success('Pedido duplicado com sucesso!');
        },
        onError: (error) => toast.error(`Erro ao duplicar: ${error.message}`)
    });

    // --- Lógica de Rolagem Horizontal ---
    const handleMouseDown = (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('button')) return;
        setIsDraggingScroll(true);
        const container = scrollContainerRef.current;
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
    };
    const handleMouseLeaveOrUp = () => {
        if (!isDraggingScroll) return;
        setIsDraggingScroll(false);
        if (scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
    };
    const handleMouseMove = (e) => {
        if (!isDraggingScroll) return;
        e.preventDefault();
        const container = scrollContainerRef.current;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX);
        container.scrollLeft = scrollLeft - walk;
    };

    // --- Lógica de Ordenação ---
    const sortOptions = [
        { value: '', label: 'Padrão' },
        { value: 'titulo_asc', label: 'Nome (A-Z)' },
        { value: 'titulo_desc', label: 'Nome (Z-A)' },
        { value: 'data_entrega_prevista_asc', label: 'Entrega (Mais Próxima)' },
        { value: 'data_entrega_prevista_desc', label: 'Entrega (Mais Distante)' },
        { value: 'data_solicitacao_desc', label: 'Solicitação (Mais Recente)' },
        { value: 'data_solicitacao_asc', label: 'Solicitação (Mais Antiga)' },
    ];

    const handleSortChange = (colunaId, sortValue) => {
        if (!sortValue) {
            const newSorting = { ...sorting };
            delete newSorting[colunaId];
            setSorting(newSorting);
        } else {
            const lastUnderscoreIndex = sortValue.lastIndexOf('_');
            const sortBy = sortValue.substring(0, lastUnderscoreIndex);
            const order = sortValue.substring(lastUnderscoreIndex + 1);
            setSorting(prev => ({ ...prev, [colunaId]: { sortBy, order } }));
        }
        setOpenSortMenu(null);
    };

    // Agrupa e Ordena Pedidos
    const pedidosPorColuna = useMemo(() => {
        const grouped = {};
        statusColumns.forEach(coluna => {
            const pedidosDaColuna = [...pedidos.filter(p => p.status === coluna.id)];
            const sortConfig = sorting[coluna.id];
            if (sortConfig) {
                pedidosDaColuna.sort((a, b) => {
                    const { sortBy, order } = sortConfig;
                    let valA, valB;
                    if (sortBy === 'titulo') { valA = a.titulo?.toLowerCase() || ''; valB = b.titulo?.toLowerCase() || ''; }
                    else if (sortBy === 'data_entrega_prevista' || sortBy === 'data_solicitacao') { valA = a[sortBy] ? new Date(a[sortBy]) : null; valB = b[sortBy] ? new Date(b[sortBy]) : null; }
                    if (valA === valB) return 0; if (valA === null) return 1; if (valB === null) return -1;
                    const direction = order === 'asc' ? 1 : -1;
                    if (valA instanceof Date) return (valA - valB) * direction;
                    if (typeof valA === 'string') return valA.localeCompare(valB) * direction;
                    return 0;
                });
            } else {
                pedidosDaColuna.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
            grouped[coluna.id] = pedidosDaColuna;
        });
        return grouped;
    }, [pedidos, sorting]);


    // --- Drag & Drop dos Cards ---
    const handleDragStart = (e, pedido) => {
        setDraggedPedido(pedido);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e, columnId) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };
    const handleDrop = (e, targetColumnId) => {
        e.preventDefault();
        setDragOverColumn(null);
        if (!draggedPedido) return;
        if (draggedPedido.status === targetColumnId) return;
        updateStatusMutation.mutate({ pedidoId: draggedPedido.id, newStatus: targetColumnId });
        setDraggedPedido(null);
    };

    const handleDeleteAll = (columnId) => {
        const pedidosParaDeletar = pedidosPorColuna[columnId];
        if (!pedidosParaDeletar || pedidosParaDeletar.length === 0) return;

        toast("Excluir Todos os Pedidos", {
            description: `Tem certeza que deseja excluir permanentemente os ${pedidosParaDeletar.length} pedidos desta coluna? Esta ação não pode ser desfeita.`,
            action: {
                label: "Excluir Tudo",
                onClick: () => {
                    setDeletingColumnId(columnId);
                    const idsParaDeletar = pedidosParaDeletar.map(p => p.id);
                    onDeleteAllCanceled(idsParaDeletar);
                },
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' },
        });
    };

    return (
        <div 
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto p-4 h-full bg-gray-100 cursor-grab min-h-[calc(100vh-200px)]"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
        >
            {statusColumns.map(column => (
                <div 
                    key={column.id}
                    className="w-80 flex-shrink-0 bg-white rounded-lg shadow-sm flex flex-col kanban-card"
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={(e) => handleDrop(e, column.id)}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span>{column.title}</span>
                            <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                                {pedidosPorColuna[column.id]?.length || 0}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {canDelete && column.id === 'Cancelado' && (pedidosPorColuna[column.id]?.length || 0) > 0 && (
                                <button 
                                    onClick={() => handleDeleteAll(column.id)}
                                    disabled={deletingColumnId === column.id}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                    title={`Excluir todos os ${pedidosPorColuna[column.id].length} pedidos`}
                                >
                                    <FontAwesomeIcon 
                                        icon={deletingColumnId === column.id ? faSpinner : faTrash} 
                                        spin={deletingColumnId === column.id} 
                                    />
                                </button>
                            )}

                            <div className="relative">
                                <button 
                                    onClick={() => setOpenSortMenu(openSortMenu === column.id ? null : column.id)} 
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                    title="Ordenar coluna"
                                >
                                    <FontAwesomeIcon icon={faSort} />
                                </button>
                                
                                {openSortMenu === column.id && (
                                    <div ref={sortMenuRef} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 text-left">
                                        <p className="p-2 font-semibold text-xs text-gray-500 border-b bg-gray-50">Ordenar por:</p>
                                        {sortOptions.map(option => (
                                            <button 
                                                key={option.value} 
                                                onClick={() => handleSortChange(column.id, option.value)} 
                                                className={`block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                                    (sorting[column.id] && `${sorting[column.id].sortBy}_${sorting[column.id].order}` === option.value) || (!sorting[column.id] && option.value === '') 
                                                    ? 'text-blue-600 font-medium bg-blue-50' 
                                                    : 'text-gray-700'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`p-2 flex-1 overflow-y-auto space-y-3 min-h-[100px] ${dragOverColumn === column.id ? 'bg-blue-50/50' : ''}`}>
                        {pedidosPorColuna[column.id]?.map(pedido => (
                            <div 
                                key={pedido.id} 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, pedido)}
                                className="cursor-move active:cursor-grabbing"
                            >
                                <PedidoCard 
                                    pedido={pedido} 
                                    onStatusChange={(pid, status) => updateStatusMutation.mutate({ pedidoId: pid, newStatus: status })}
                                    onDuplicate={() => duplicatePedidoMutation.mutate(pedido)}
                                    allStatusColumns={statusColumns.map(c => c.id)}
                                    onCardClick={onCardClick}
                                />
                            </div>
                        ))}
                        
                        {pedidosPorColuna[column.id]?.length === 0 && (
                            <div className="h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs m-2">
                                Arraste aqui
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}