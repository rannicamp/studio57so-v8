// components/ComprasKanban.js
'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import PedidoCard from './PedidoCard'; // Certifique-se que o caminho está correto
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faSort, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext'; // Certifique-se que o caminho está correto
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Definição das colunas do Kanban (sem alterações)
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

export default function ComprasKanban({ pedidos, setPedidos, onCardClick }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();
    const [dragOverColumn, setDragOverColumn] = useState(null);
    const scrollContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const draggedItemRef = useRef(null);
    const [sortCriteria, setSortCriteria] = useState('data_solicitacao');
    const [sortDirection, setSortDirection] = useState('desc');

    // ======================= NOVOS ESTADOS PARA O "PAN" =======================
    const [isPanning, setIsPanning] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    // ========================================================================


    // Funções de Drag and Drop (Cards)
    const handleDragStart = (e, pedido) => {
        // Não deixa o "pan" ser ativado
        setIsPanning(false);
        
        e.dataTransfer.setData('pedidoId', pedido.id);
        e.dataTransfer.effectAllowed = 'move';
        draggedItemRef.current = pedido;
        setIsDragging(true);
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        setIsDragging(false);
        draggedItemRef.current = null;
        setDragOverColumn(null);
        if (e.currentTarget) e.currentTarget.style.opacity = '1';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e, columnId) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };

    const handleDrop = (e, columnId) => {
        e.preventDefault();
        const pedidoId = e.dataTransfer.getData('pedidoId');
        if (draggedItemRef.current && draggedItemRef.current.id == pedidoId) {
            handleStatusChange(parseInt(pedidoId), columnId);
        }
        setDragOverColumn(null);
        setIsDragging(false);
        if (draggedItemRef.current) {
            const draggedElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
            if (draggedElement) draggedElement.style.opacity = '1';
        }
        draggedItemRef.current = null;
    };


    // Handlers para Touch (Cards)
    const handleTouchStart = (e, pedido) => {
        // Não deixa o "pan" ser ativado
        setIsPanning(false);

        draggedItemRef.current = pedido;
        setIsDragging(true);
        e.currentTarget.style.opacity = '0.5';
        e.currentTarget.classList.add('dragging-touch');
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !draggedItemRef.current) return;
        e.preventDefault(); // Previne scroll da página
        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const columnElement = targetElement?.closest('[data-column-id]');
        if (columnElement) {
            const columnId = columnElement.getAttribute('data-column-id');
            if (columnId !== dragOverColumn) {
                setDragOverColumn(columnId);
            }
        } else {
            setDragOverColumn(null);
        }
    };

    const handleTouchEnd = (e) => {
        if (!isDragging || !draggedItemRef.current) {
            setIsDragging(false);
            return;
        }
        const pedidoId = draggedItemRef.current.id;
        const targetElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
        if (targetElement) {
            targetElement.style.opacity = '1';
            targetElement.classList.remove('dragging-touch');
        }
        if (dragOverColumn) {
            handleStatusChange(pedidoId, dragOverColumn);
        }
        setDragOverColumn(null);
        setIsDragging(false);
        draggedItemRef.current = null;
    };

    // useEffect para listeners de touch (Previne scroll global)
    useEffect(() => {
        const preventDefault = (e) => {
            if (isDragging) { // Só previne se estiver arrastando CARD
                e.preventDefault();
            }
        };
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('touchmove', preventDefault, { passive: false });
        }
        return () => {
            if (container) {
                container.removeEventListener('touchmove', preventDefault);
            }
        };
    }, [isDragging]); // Depende do isDragging (card)


    // ======================= LÓGICA DO "PAN" (Arrastar Tela) =======================
    // O PORQUÊ: Adicionamos de volta a lógica de clicar e arrastar a tela.
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleMouseDown = (e) => {
            // 1. Ignora se for clique do botão direito/meio
            if (e.button !== 0) return; 
            
            // 2. CORREÇÃO: Ignora se o clique for em um CARD (para não quebrar o drag-drop do card)
            if (e.target.closest('[draggable="true"]')) return;
            
            // 3. Ignora se for em botões, links ou na própria barra de rolagem
            if (e.target.closest('button') || e.target.closest('a') || e.clientY >= container.clientHeight - 20) { // 20px de tolerância para a barra
                return;
            }

            // Inicia o "pan"
            setIsPanning(true);
            setStartX(e.pageX - container.offsetLeft);
            setScrollLeft(container.scrollLeft);
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none'; // Previne seleção de texto
        };

        const handleMouseLeaveOrUp = () => {
            setIsPanning(false);
            container.style.cursor = 'grab';
            container.style.userSelect = 'auto';
        };

        const handleMouseMove = (e) => {
            if (!isPanning) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1.5; // Multiplicador da velocidade
            container.scrollLeft = scrollLeft - walk;
        };

        // Adiciona os listeners
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mouseleave', handleMouseLeaveOrUp);
        container.addEventListener('mouseup', handleMouseLeaveOrUp);
        container.addEventListener('mousemove', handleMouseMove);
        
        // Define o cursor inicial
        container.style.cursor = 'grab';

        // Limpeza
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('mouseleave', handleMouseLeaveOrUp);
            container.removeEventListener('mouseup', handleMouseLeaveOrUp);
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isPanning, startX, scrollLeft]); // Depende dos estados do "pan"
    // ============================================================================


    // Mutation para ATUALIZAR status (sem alterações)
    const updatePedidoStatusMutation = useMutation({
        mutationFn: async ({ pedidoId, newStatus }) => {
            const { data: updatedPedido, error: statusError } = await supabase
                .from('pedidos_compra')
                .update({ status: newStatus })
                .eq('id', pedidoId)
                .select('*, empreendimento_id')
                .single();
            if (statusError) {
                throw new Error(`Erro ao atualizar status: ${statusError.message}`);
            }
            return updatedPedido;
        },
        onSuccess: (updatedPedido, variables) => {
            toast.success(`Status do pedido "${updatedPedido.titulo || updatedPedido.id}" atualizado para ${variables.newStatus}!`);
            
            // Invalida as queries para buscar dados frescos (sem alterar o estado local)
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });

            if (variables.newStatus === 'Entregue' && updatedPedido?.empreendimento_id && organizacaoId) {
                queryClient.invalidateQueries({ queryKey: ['estoque', updatedPedido.empreendimento_id, organizacaoId] });
            }
        },
        onError: (error, variables) => {
            console.error(`Erro ao tentar atualizar pedido ${variables.pedidoId} para status ${variables.newStatus}:`, error);
            toast.error(`Falha ao atualizar status: ${error.message}`, {
                icon: <FontAwesomeIcon icon={faExclamationTriangle} />,
                duration: 8000
            });
            // Força a revalidação em caso de erro para reverter
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
        },
    });

    // Função de mudança de status (sem alterações)
    const handleStatusChange = (pedidoId, newStatus) => {
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido && pedido.status !== newStatus) {
            console.log(`Tentando mudar status do pedido ${pedidoId} de "${pedido.status}" para "${newStatus}"`);
            updatePedidoStatusMutation.mutate({ pedidoId, newStatus });
        } else if (pedido && pedido.status === newStatus) {
            console.log(`Pedido ${pedidoId} já está no status "${newStatus}". Nenhuma ação tomada.`);
        }
    };

    // Função de Duplicação (sem alterações)
    const handleDuplicatePedido = async (pedidoOriginal) => {
        const toastId = toast.loading('Duplicando pedido...');
        try {
            const { id, created_at, data_solicitacao, ...pedidoBase } = pedidoOriginal;
            const novoPedidoData = {
                ...pedidoBase,
                status: 'Solicitação',
                solicitante_id: user.id,
                titulo: pedidoBase.titulo ? `${pedidoBase.titulo} (Cópia)` : `Cópia do Pedido ${id}`,
                data_solicitacao: new Date().toISOString(),
                organizacao_id: organizacaoId,
                data_entrega_prevista: null,
                data_entrega_real: null,
                valor_total_estimado: null,
            };

            if (novoPedidoData.empreendimentos) delete novoPedidoData.empreendimentos;
            if (novoPedidoData.solicitante) delete novoPedidoData.solicitante;
            delete novoPedidoData.itens;
            delete novoPedidoData.anexos;

            const { data: novoPedido, error: pedidoError } = await supabase
                .from('pedidos_compra')
                .insert(novoPedidoData)
                .select('*')
                .single();

            if (pedidoError) throw pedidoError;

            if (pedidoOriginal.itens && pedidoOriginal.itens.length > 0) {
                const novosItens = pedidoOriginal.itens.map(item => {
                    const { id: itemId, pedido_compra_id, created_at, fornecedor, ...itemBase } = item;
                    return {
                        ...itemBase,
                        pedido_compra_id: novoPedido.id,
                        organizacao_id: organizacaoId,
                        fornecedor_id: item.fornecedor_id ? item.fornecedor_id : null,
                    };
                });
                const { error: itensError } = await supabase
                    .from('pedidos_compra_itens')
                    .insert(novosItens);
                if (itensError) {
                    await supabase.from('pedidos_compra').delete().eq('id', novoPedido.id);
                    throw itensError;
                }
            }
            toast.success('Pedido duplicado com sucesso!', { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
        } catch (error) {
            console.error("Erro ao duplicar pedido:", error);
            toast.error(`Falha ao duplicar pedido: ${error.message}`, { id: toastId });
        }
    };


    // Ordenação (sem alterações)
    const toggleSort = (criteria) => {
        if (sortCriteria === criteria) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCriteria(criteria);
            setSortDirection('asc');
        }
    };

    // Agrupamento e Ordenação (sem alterações)
    const groupedData = useMemo(() => {
        const grouped = statusColumns.reduce((acc, column) => {
            acc[column.id] = { title: column.title, pedidos: [], valorTotal: 0 };
            return acc;
        }, {});

        pedidos.forEach(pedido => {
            // O PORQUÊ: O status 'Pedido Realizado' (do código antigo) agora é 'Solicitação'.
            // Esta lógica garante que ambos caiam na coluna 'Solicitação'.
            const statusKey = pedido.status === 'Pedido Realizado' ? 'Solicitação' : pedido.status;
            if (grouped[statusKey]) {
                grouped[statusKey].pedidos.push(pedido);
                const valorEstimado = parseFloat(pedido.valor_total_estimado);
                if (!isNaN(valorEstimado)) {
                    grouped[statusKey].valorTotal += valorEstimado;
                }
            } else {
                 console.warn(`Pedido ${pedido.id} com status inesperado: ${pedido.status}`);
            }
        });

        Object.keys(grouped).forEach(status => {
            grouped[status].pedidos.sort((a, b) => {
                let valA, valB;
                if (sortCriteria === 'data_solicitacao' || sortCriteria === 'data_entrega_prevista') {
                    valA = a[sortCriteria] ? new Date(a[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000));
                    valB = b[sortCriteria] ? new Date(b[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000));
                } else if (sortCriteria === 'valor_total_estimado') {
                    valA = parseFloat(a[sortCriteria]) || 0;
                    valB = parseFloat(b[sortCriteria]) || 0;
                } else {
                    valA = a[sortCriteria]?.toString().toLowerCase() || '';
                    valB = b[sortCriteria]?.toString().toLowerCase() || '';
                }
                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        });
        return grouped;
    }, [pedidos, sortCriteria, sortDirection]);


    // Função de checagem (sem alterações)
    const checkPendingItems = (pedido) => {
        if (!pedido || !pedido.itens || pedido.itens.length === 0) {
            return false;
        }
        return pedido.itens.some(item =>
            !item.fornecedor_id || item.preco_unitario_real === null || item.preco_unitario_real === undefined || item.preco_unitario_real <= 0
        );
    };

    // ======================= JSX DO KANBAN (COM CORREÇÃO DE LAYOUT) =======================
    return (
        <div 
            ref={scrollContainerRef} 
            // O PORQUÊ: Removemos 'space-x-4' (que causava a coluna branca)
            // Adicionamos 'pl-4' para dar o espaçamento inicial
            className="flex overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 relative pl-4"
            onDragOver={handleDragOver}
        >
            {/* Botão de Ordenação (sem alterações, mas agora flutua sobre o 'pl-4') */}
            <div className="sticky left-4 top-2 z-20 bg-white p-1 rounded-full shadow border flex items-center text-xs">
                <button
                    onClick={() => toggleSort('data_solicitacao')}
                    title={`Ordenar por Data da Solicitação (${sortCriteria === 'data_solicitacao' ? (sortDirection === 'asc' ? ' crescente' : ' decrescente') : ''})`}
                    className={`p-1 rounded-full ${sortCriteria === 'data_solicitacao' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FontAwesomeIcon icon={faSort} rotation={sortCriteria === 'data_solicitacao' && sortDirection === 'desc' ? 180 : 0} /> Data Sol.
                </button>
                <button
                    onClick={() => toggleSort('data_entrega_prevista')}
                    title={`Ordenar por Data Prev. Entrega (${sortCriteria === 'data_entrega_prevista' ? (sortDirection === 'asc' ? ' crescente' : ' decrescente') : ''})`}
                    className={`p-1 rounded-full ${sortCriteria === 'data_entrega_prevista' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FontAwesomeIcon icon={faSort} rotation={sortCriteria === 'data_entrega_prevista' && sortDirection === 'desc' ? 180 : 0} /> Data Ent.
                </button>
            </div>

            {/* Colunas */}
            {statusColumns.map(column => {
                const columnData = groupedData[column.id] || { title: column.title, pedidos: [], valorTotal: 0 };
                const valorTotalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(columnData.valorTotal);

                return (
                    <div
                        key={column.id}
                        data-column-id={column.id}
                        // O PORQUÊ: Adicionamos 'mr-4' (margin-right) para espaçar as colunas, substituindo o 'space-x-4'
                        className={`bg-gray-100 rounded-lg shadow-md w-72 flex-shrink-0 flex flex-col border-t-4 transition-colors duration-200 mr-4 ${dragOverColumn === column.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        onDragEnter={(e) => handleDragEnter(e, column.id)}
                        onDragLeave={() => setDragOverColumn(null)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, column.id)}
                    >
                        {/* Cabeçalho da Coluna */}
                        <div className="text-sm font-semibold p-3 border-b bg-white rounded-t-lg sticky top-0 z-10 flex justify-between items-center">
                            <span>{column.title}</span>
                            <span className="text-xs font-normal bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{columnData.pedidos.length}</span>
                        </div>

                        {/* Valor Total da Coluna */}
                        <p className="text-xs text-gray-500 px-3 pt-2 font-medium">
                            Valor Total: <span className="font-bold text-gray-700">{valorTotalFormatado}</span>
                        </p>

                        {/* Cards */}
                        <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
                            {columnData.pedidos.map(pedido => {
                                const displayStatus = pedido.status;
                                const hasPendingInvoice = pedido.status === 'Realizado' && (!pedido.anexos || !pedido.anexos.some(anexo => anexo.descricao === 'Nota Fiscal'));
                                const hasPendingItems = ['Em Cotação', 'Em Negociação', 'Revisão do Responsável'].includes(displayStatus) && checkPendingItems(pedido);

                                return (
                                    <PedidoCard
                                        key={pedido.id}
                                        pedido={{ ...pedido, status: displayStatus }}
                                        onStatusChange={handleStatusChange}
                                        onDuplicate={handleDuplicatePedido}
                                        allStatusColumns={statusColumns.map(s => s.id)}
                                        hasPendingInvoice={hasPendingInvoice}
                                        hasPendingItems={hasPendingItems}
                                        onCardClick={onCardClick}
                                        // Handlers de drag/touch
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, pedido)}
                                        onTouchStart={(e) => handleTouchStart(e, pedido)}
                                        data-pedido-id={pedido.id}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                    />
                                );
                            })}
                            {/* Feedback de Drop */}
                            {dragOverColumn === column.id && (
                                <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 text-center text-blue-500 text-sm">
                                    Solte aqui para mover
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}