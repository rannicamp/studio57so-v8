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
        // Aplica estilo diretamente para feedback visual rápido
        if (e.currentTarget) e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        setIsDragging(false);
        draggedItemRef.current = null;
        setDragOverColumn(null);
        // Remove o estilo diretamente
        if (e.currentTarget) e.currentTarget.style.opacity = '1';
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessário para permitir o drop
    };

    const handleDragEnter = (e, columnId) => {
        e.preventDefault();
        // Evita re-renderizações desnecessárias se já estiver sobre a mesma coluna
        if (dragOverColumn !== columnId) {
            setDragOverColumn(columnId);
        }
    };

     const handleDragLeave = (e, columnId) => {
        // Verifica se o mouse realmente saiu da coluna e não apenas entrou em um filho
        if (e.currentTarget.contains(e.relatedTarget)) return;
        if (dragOverColumn === columnId) {
            setDragOverColumn(null);
        }
    };


    const handleDrop = (e, columnId) => {
        e.preventDefault();
        const pedidoId = e.dataTransfer.getData('pedidoId');
        // Verifica se o ID é válido e corresponde ao item arrastado
        if (pedidoId && draggedItemRef.current && draggedItemRef.current.id == pedidoId) {
            handleStatusChange(parseInt(pedidoId), columnId);
        }
        setDragOverColumn(null);
        setIsDragging(false); // Garante que isDragging seja resetado
         // Remove o estilo diretamente do elemento que foi arrastado
        const draggedElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
        if (draggedElement) draggedElement.style.opacity = '1';

        draggedItemRef.current = null;
    };


    // Handlers para Touch (Cards)
    const handleTouchStart = (e, pedido) => {
        // Não deixa o "pan" ser ativado
        setIsPanning(false);

        draggedItemRef.current = pedido;
        setIsDragging(true);
        // Feedback visual
        e.currentTarget.style.opacity = '0.5';
        e.currentTarget.classList.add('dragging-touch'); // Classe para estilos adicionais se necessário
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !draggedItemRef.current) return;
        // Previne o scroll da página enquanto arrasta o card
         if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        // Encontra o elemento da coluna sob o toque
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const columnElement = targetElement?.closest('[data-column-id]');
        const columnId = columnElement ? columnElement.getAttribute('data-column-id') : null;

        // Atualiza a coluna de destino visualmente
        if (columnId !== dragOverColumn) {
            setDragOverColumn(columnId);
        }
    };

    const handleTouchEnd = (e) => {
        if (!isDragging || !draggedItemRef.current) {
            setIsDragging(false); // Reseta se não estava arrastando
            return;
        }
        const pedidoId = draggedItemRef.current.id;
        // Remove feedback visual
        const targetElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
        if (targetElement) {
            targetElement.style.opacity = '1';
            targetElement.classList.remove('dragging-touch');
        }

        // Se soltou sobre uma coluna válida, atualiza o status
        if (dragOverColumn) {
            handleStatusChange(pedidoId, dragOverColumn);
        }

        // Reseta os estados
        setDragOverColumn(null);
        setIsDragging(false);
        draggedItemRef.current = null;
    };


    // useEffect para listeners de touch (Previne scroll global ao arrastar card)
    useEffect(() => {
        const preventDefault = (e) => {
            if (isDragging) { // Só previne se estiver arrastando CARD
                if (e.cancelable) e.preventDefault();
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

            // 3. Ignora se for em botões, links, selects, inputs ou na própria barra de rolagem
            if (e.target.closest('button, a, select, input') || e.clientY >= container.clientHeight - 20) { // 20px de tolerância para a barra
                return;
            }

            // Inicia o "pan"
            setIsPanning(true);
            setStartX(e.pageX - container.offsetLeft);
            setScrollLeft(container.scrollLeft);
            container.style.cursor = 'grabbing'; // Muda o cursor
            container.style.userSelect = 'none'; // Previne seleção de texto
        };

        const handleMouseLeaveOrUp = () => {
             if (isPanning) { // Só executa se estava fazendo pan
                setIsPanning(false);
                container.style.cursor = 'grab'; // Restaura o cursor
                container.style.userSelect = 'auto'; // Restaura seleção de texto
            }
        };

        const handleMouseMove = (e) => {
            if (!isPanning) return;
            e.preventDefault(); // Previne outros comportamentos como seleção
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1.5; // Multiplicador da velocidade do scroll
            container.scrollLeft = scrollLeft - walk;
        };

        // Adiciona os listeners ao container
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mouseleave', handleMouseLeaveOrUp);
        container.addEventListener('mouseup', handleMouseLeaveOrUp);
        container.addEventListener('mousemove', handleMouseMove);

        // Define o cursor inicial
        container.style.cursor = 'grab';

        // Limpeza: remove os listeners quando o componente desmonta ou as dependências mudam
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
                .select('*, empreendimento_id') // Seleciona empreendimento_id para invalidação do estoque
                .single();
            if (statusError) {
                throw new Error(`Erro ao atualizar status: ${statusError.message}`);
            }

            // Adiciona entrada no histórico
             const { error: historyError } = await supabase
                .from('pedidos_compra_status_historico')
                .insert({
                    pedido_compra_id: pedidoId,
                    status_novo: newStatus,
                    usuario_id: user?.id,
                    data_mudanca: new Date().toISOString(),
                    organizacao_id: organizacaoId,
                });
            if (historyError) {
                console.warn(`Erro ao registrar histórico de status: ${historyError.message}`);
                // Não lança erro aqui, atualização principal funcionou
            }

            return updatedPedido;
        },
        onSuccess: (updatedPedido, variables) => {
            toast.success(`Status do pedido "${updatedPedido.titulo || updatedPedido.id}" atualizado para ${variables.newStatus}!`);

            // Invalida as queries para buscar dados frescos (sem alterar o estado local)
            // Usar queryKey mais específico se possível
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });

            // Invalida estoque se o status for 'Entregue'
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
            // Força a revalidação em caso de erro para reverter visualmente
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId] });
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
            // Remove campos que não devem ser copiados ou que serão redefinidos
             const { id, created_at, data_solicitacao, empreendimentos, solicitante, itens, anexos, ...pedidoBase } = pedidoOriginal;

            const novoPedidoData = {
                ...pedidoBase,
                status: 'Solicitação', // Status inicial para cópia
                solicitante_id: user.id, // Usuário atual como solicitante
                titulo: pedidoBase.titulo ? `${pedidoBase.titulo} (Cópia)` : `Cópia do Pedido ${id}`,
                data_solicitacao: new Date().toISOString(), // Data atual
                organizacao_id: organizacaoId, // Organização atual
                // Resetar datas de entrega e valor
                data_entrega_prevista: null,
                data_entrega_real: null,
                valor_total_estimado: null, // Será recalculado
                valor_total_real: null, // Será recalculado
            };

            // Insere o novo pedido
            const { data: novoPedido, error: pedidoError } = await supabase
                .from('pedidos_compra')
                .insert(novoPedidoData)
                .select('*')
                .single();

            if (pedidoError) throw pedidoError;

            // Copia os itens, se existirem
            if (itens && itens.length > 0) {
                const novosItens = itens.map(item => {
                    // Remove IDs e campos relacionados ao pedido original
                    const { id: itemId, pedido_compra_id, created_at, fornecedor, etapa, ...itemBase } = item;
                    return {
                        ...itemBase,
                        pedido_compra_id: novoPedido.id, // Linka ao novo pedido
                        organizacao_id: organizacaoId,
                        // Mantém fornecedor e etapa se existirem no original
                        fornecedor_id: item.fornecedor_id ? item.fornecedor_id : null,
                        etapa_id: item.etapa_id ? item.etapa_id : null,
                        // Resetar custos
                        preco_unitario_estimado: item.preco_unitario_estimado, // Mantem estimativa?
                        preco_unitario_real: null,
                        custo_total_estimado: item.custo_total_estimado, // Mantem estimativa?
                        custo_total_real: null,
                    };
                });
                const { error: itensError } = await supabase
                    .from('pedidos_compra_itens')
                    .insert(novosItens);

                // Se a cópia dos itens falhar, remove o pedido criado
                if (itensError) {
                    await supabase.from('pedidos_compra').delete().eq('id', novoPedido.id);
                    throw itensError;
                }
            }
            toast.success('Pedido duplicado com sucesso!', { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId] }); // Atualiza o painel
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
            setSortDirection('asc'); // Padrão é ascendente ao trocar critério
        }
    };

    // Agrupamento e Ordenação (sem alterações na lógica principal)
    const groupedData = useMemo(() => {
        const grouped = statusColumns.reduce((acc, column) => {
            acc[column.id] = { title: column.title, pedidos: [], valorTotalEstimado: 0 }; // Renomeado para clareza
            return acc;
        }, {});

        pedidos.forEach(pedido => {
             // Garante que o status 'Pedido Realizado' (antigo) seja mapeado para 'Solicitação'
            const statusKey = pedido.status === 'Pedido Realizado' ? 'Solicitação' : pedido.status;
            if (grouped[statusKey]) {
                grouped[statusKey].pedidos.push(pedido);
                 // Calcula o valor total estimado da coluna
                const valorEstimadoPedido = pedido.itens?.reduce((sum, item) => sum + (parseFloat(item.custo_total_estimado) || 0), 0) || 0;
                grouped[statusKey].valorTotalEstimado += valorEstimadoPedido;
            } else {
                console.warn(`Pedido ${pedido.id} com status inesperado ou não mapeado: ${pedido.status}`);
                 // Opcional: Adicionar a uma coluna 'Outros' ou tratar como erro
            }
        });

        // Ordena os pedidos dentro de cada coluna
        Object.keys(grouped).forEach(status => {
            grouped[status].pedidos.sort((a, b) => {
                let valA, valB;
                if (sortCriteria === 'data_solicitacao' || sortCriteria === 'data_entrega_prevista') {
                    // Trata datas nulas para ordenação consistente
                    valA = a[sortCriteria] ? new Date(a[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000)); // Data muito antiga ou muito futura
                    valB = b[sortCriteria] ? new Date(b[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000));
                } else if (sortCriteria === 'valor_total_estimado') {
                    // Calcula valor estimado on-the-fly para ordenação, se não estiver no pedido principal
                    valA = a.itens?.reduce((sum, item) => sum + (parseFloat(item.custo_total_estimado) || 0), 0) || 0;
                    valB = b.itens?.reduce((sum, item) => sum + (parseFloat(item.custo_total_estimado) || 0), 0) || 0;
                } else { // Ordena por título (case-insensitive)
                    valA = a.titulo?.toString().toLowerCase() || '';
                    valB = b.titulo?.toString().toLowerCase() || '';
                }

                // Lógica de comparação padrão
                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        });
        return grouped;
    }, [pedidos, sortCriteria, sortDirection]);


    // Função de checagem de itens pendentes (sem alterações)
    const checkPendingItems = (pedido) => {
        if (!pedido || !pedido.itens || pedido.itens.length === 0) {
            return false; // Não há itens, logo não há pendências de itens
        }
        // Verifica se ALGUM item não tem fornecedor OU não tem preço real definido (ou é <= 0)
        return pedido.itens.some(item =>
            !item.fornecedor_id || item.preco_unitario_real === null || item.preco_unitario_real === undefined || item.preco_unitario_real <= 0
        );
    };

    // ======================= JSX DO KANBAN (COM CORREÇÃO DE LAYOUT) =======================
    return (
        <div
            ref={scrollContainerRef}
            // ***** CORREÇÃO DE LAYOUT: Remove padding esquerdo *****
            // O 'porquê': O contêiner pai na page.js agora controla o padding geral.
            // O espaçamento entre colunas é dado pelo 'mr-4' em cada coluna.
            className="flex overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 relative"
            onDragOver={handleDragOver} // DragOver no container pai
        >
            {/* Botão de Ordenação (Posicionado sticky à esquerda) */}
            {/* O 'porquê': Mantido sticky, mas 'left-0' garante que cole na borda do contêiner pai */}
            <div className="sticky left-0 top-2 z-20 bg-white p-1 rounded-full shadow border flex items-center text-xs ml-1 mr-3"> {/* Ajustes de margem */}
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
                 <button
                    onClick={() => toggleSort('valor_total_estimado')}
                    title={`Ordenar por Valor Estimado (${sortCriteria === 'valor_total_estimado' ? (sortDirection === 'asc' ? ' crescente' : ' decrescente') : ''})`}
                    className={`p-1 rounded-full ${sortCriteria === 'valor_total_estimado' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FontAwesomeIcon icon={faSort} rotation={sortCriteria === 'valor_total_estimado' && sortDirection === 'desc' ? 180 : 0} /> Valor
                </button>
            </div>

            {/* Colunas */}
            {statusColumns.map((column, index) => { // Adicionado index
                const columnData = groupedData[column.id] || { title: column.title, pedidos: [], valorTotalEstimado: 0 };
                const valorTotalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(columnData.valorTotalEstimado);

                return (
                    <div
                        key={column.id}
                        data-column-id={column.id}
                        // ***** CORREÇÃO DE LAYOUT: Garante margem direita, exceto na última *****
                        // O 'porquê': Cria o espaçamento correto entre as colunas.
                        className={`bg-gray-100 rounded-lg shadow-md w-72 flex-shrink-0 flex flex-col border-t-4 transition-colors duration-200 ${index < statusColumns.length -1 ? 'mr-4' : ''} ${dragOverColumn === column.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        onDragEnter={(e) => handleDragEnter(e, column.id)}
                        onDragLeave={(e) => handleDragLeave(e, column.id)} // Adicionado DragLeave na coluna
                        // onDragEnd={handleDragEnd} // DragEnd é no item arrastado
                        onDrop={(e) => handleDrop(e, column.id)}
                    >
                        {/* Cabeçalho da Coluna */}
                        <div className="text-sm font-semibold p-3 border-b bg-white rounded-t-lg sticky top-0 z-10 flex justify-between items-center">
                            <span>{column.title}</span>
                            <span className="text-xs font-normal bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{columnData.pedidos.length}</span>
                        </div>

                        {/* Valor Total Estimado da Coluna */}
                        <p className="text-xs text-gray-500 px-3 pt-2 font-medium">
                            Valor Estimado: <span className="font-bold text-gray-700">{valorTotalFormatado}</span>
                        </p>

                        {/* Cards */}
                         {/* O 'porquê': max-h-[calc(100vh-250px)] tenta fazer a coluna ocupar mais altura vertical */}
                        <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1 max-h-[calc(100vh-250px)]">
                            {columnData.pedidos.map(pedido => {
                                // Exibe o status atual do pedido
                                const displayStatus = pedido.status;
                                // Pendência de NF: Status 'Entregue' E (sem anexos OU nenhum anexo é NF)
                                const hasPendingInvoice = displayStatus === 'Entregue' && (!pedido.anexos || pedido.anexos.length === 0 || !pedido.anexos.some(anexo => anexo.descricao && anexo.descricao.toLowerCase().includes('nota fiscal')));
                                // Pendência de Itens: Status intermediários E função checkPendingItems retorna true
                                const hasPendingItems = ['Em Cotação', 'Em Negociação', 'Revisão do Responsável'].includes(displayStatus) && checkPendingItems(pedido);

                                return (
                                    <PedidoCard
                                        key={pedido.id}
                                        // Passa o pedido com o status correto para exibição
                                        pedido={{ ...pedido, status: displayStatus }}
                                        onStatusChange={handleStatusChange}
                                        onDuplicate={handleDuplicatePedido}
                                        allStatusColumns={statusColumns.map(s => s.id)}
                                        hasPendingInvoice={hasPendingInvoice}
                                        hasPendingItems={hasPendingItems} // Passa a flag de itens pendentes
                                        onCardClick={onCardClick}
                                        // Handlers de drag/touch para o card
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, pedido)}
                                        onDragEnd={handleDragEnd} // DragEnd no item
                                        onTouchStart={(e) => handleTouchStart(e, pedido)}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        data-pedido-id={pedido.id} // Para identificar o elemento arrastado
                                    />
                                );
                            })}
                            {/* Feedback de Drop (Placeholder visual) */}
                            {dragOverColumn === column.id && (
                                <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 text-center text-blue-500 text-sm mt-2 h-20 flex items-center justify-center"> {/* Estilo de placeholder */}
                                    Solte aqui
                                </div>
                            )}
                             {/* Espaço vazio se não houver cards e não estiver arrastando sobre */}
                             {columnData.pedidos.length === 0 && dragOverColumn !== column.id && (
                                 <div className="h-10"></div> // Pequeno espaço
                             )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}