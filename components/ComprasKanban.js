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

// REMOVEMOS a função registrarEntradaEstoquePedido daqui

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

    // Funções de Drag and Drop (sem alterações)
     const handleDragStart = (e, pedido) => {
        e.dataTransfer.setData('pedidoId', pedido.id);
        e.dataTransfer.effectAllowed = 'move';
        draggedItemRef.current = pedido; // Guarda a referência do pedido sendo arrastado
        setIsDragging(true);
        e.currentTarget.style.opacity = '0.5'; // Deixa o card semitransparente ao arrastar
    };

    const handleDragEnd = (e) => {
        setIsDragging(false);
        draggedItemRef.current = null;
        setDragOverColumn(null); // Limpa a coluna destacada
        if(e.currentTarget) e.currentTarget.style.opacity = '1'; // Restaura a opacidade
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessário para permitir o drop
    };

    const handleDragEnter = (e, columnId) => {
        e.preventDefault();
        setDragOverColumn(columnId); // Destaca a coluna ao passar por cima
    };

    const handleDrop = (e, columnId) => {
        e.preventDefault();
        const pedidoId = e.dataTransfer.getData('pedidoId');
        if (draggedItemRef.current && draggedItemRef.current.id == pedidoId) {
             handleStatusChange(parseInt(pedidoId), columnId); // Converte ID para número se necessário
        }
        setDragOverColumn(null); // Limpa o destaque
        setIsDragging(false); // Garante que o estado de dragging seja resetado
         if (draggedItemRef.current) {
             // Tenta encontrar o elemento e resetar a opacidade
             const draggedElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`); // Supondo que PedidoCard tenha data-pedido-id
             if (draggedElement) draggedElement.style.opacity = '1';
         }
        draggedItemRef.current = null;
    };


    // Handlers para Touch (simulam drag and drop)
    const handleTouchStart = (e, pedido) => {
        // Previne scroll enquanto arrasta o card
        // e.preventDefault(); Não previnir aqui, pode impedir o clique normal
        draggedItemRef.current = pedido;
        setIsDragging(true);
        e.currentTarget.style.opacity = '0.5';
         // Adiciona uma classe para feedback visual no mobile (opcional)
         e.currentTarget.classList.add('dragging-touch');
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !draggedItemRef.current) return;
        // Previne scroll da página enquanto move o card
         e.preventDefault();

        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const columnElement = targetElement?.closest('[data-column-id]'); // Adicione data-column-id aos divs das colunas

        if (columnElement) {
            const columnId = columnElement.getAttribute('data-column-id');
             if(columnId !== dragOverColumn) {
                 setDragOverColumn(columnId); // Atualiza visualmente a coluna de destino
            }
        } else {
             setDragOverColumn(null); // Limpa se sair de uma coluna
        }
    };

    const handleTouchEnd = (e) => {
        if (!isDragging || !draggedItemRef.current) {
             setIsDragging(false); // Garante reset mesmo sem drag
            return;
        }

        const pedidoId = draggedItemRef.current.id;
        const targetElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
         if(targetElement) {
             targetElement.style.opacity = '1';
             targetElement.classList.remove('dragging-touch'); // Remove classe de feedback
         }


        if (dragOverColumn) {
            handleStatusChange(pedidoId, dragOverColumn); // Executa a mudança de status
        }

        // Limpeza
        setDragOverColumn(null);
        setIsDragging(false);
        draggedItemRef.current = null;
    };

    // useEffect para listeners de touch (importante para previnir scroll global)
     useEffect(() => {
         const preventDefault = (e) => {
             if (isDragging) {
                 e.preventDefault();
             }
         };
         // Adiciona listener ao container do Kanban ou window se necessário
         const container = scrollContainerRef.current;
         if (container) {
             container.addEventListener('touchmove', preventDefault, { passive: false });
         }
         // window.addEventListener('touchmove', preventDefault, { passive: false });

         return () => {
             if (container) {
                 container.removeEventListener('touchmove', preventDefault);
             }
             // window.removeEventListener('touchmove', preventDefault);
         };
     }, [isDragging]); // Depende apenas do estado isDragging


    // ======================= MUTATION SIMPLIFICADA =======================
    // O PORQUÊ: Removemos a chamada à função registrarEntradaEstoquePedido.
    // O Trigger no banco de dados agora cuida da atualização do estoque.
    const updatePedidoStatusMutation = useMutation({
        mutationFn: async ({ pedidoId, newStatus }) => {
            // APENAS atualiza o status do pedido
            const { data: updatedPedido, error: statusError } = await supabase
                .from('pedidos_compra')
                .update({ status: newStatus })
                .eq('id', pedidoId)
                .select('*, empreendimento_id') // Seleciona empreendimento_id para invalidação de cache
                .single();

            if (statusError) {
                // Se o trigger no banco falhar, o erro será capturado aqui
                throw new Error(`Erro ao atualizar status: ${statusError.message}`);
            }
            return updatedPedido; // Retorna o pedido atualizado para onSuccess
        },
        onSuccess: (updatedPedido, variables) => {
            // Mostra notificação de sucesso para a mudança de status
            toast.success(`Status do pedido "${updatedPedido.titulo || updatedPedido.id}" atualizado para ${variables.newStatus}!`);

            // Atualiza o estado local para UI imediata (opcional, invalidação já faz isso)
            // Se setPedidos for uma função que aceita o array novo:
             if (typeof setPedidos === 'function') {
                setPedidos(prevPedidos =>
                    prevPedidos.map(p =>
                        p.id === variables.pedidoId ? { ...p, status: variables.newStatus } : p
                    )
                 );
            }

            // Invalida as queries relevantes para buscar dados frescos do backend
            queryClient.invalidateQueries({ queryKey: ['pedidos'] }); // Invalida a lista geral de pedidos
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] }); // Invalida a query da página principal de pedidos
            queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] }); // Invalida o detalhe específico do pedido

            // Invalida o cache do estoque SE o status mudou para 'Entregue'
            if (variables.newStatus === 'Entregue' && updatedPedido?.empreendimento_id && organizacaoId) {
                queryClient.invalidateQueries({ queryKey: ['estoque', updatedPedido.empreendimento_id, organizacaoId] });
            }
        },
        onError: (error, variables) => {
            // Exibe qualquer erro ocorrido (seja no update do status ou vindo do trigger)
             console.error(`Erro ao tentar atualizar pedido ${variables.pedidoId} para status ${variables.newStatus}:`, error);
            toast.error(`Falha ao atualizar status: ${error.message}`, {
                 icon: <FontAwesomeIcon icon={faExclamationTriangle} />,
                 duration: 8000 // Mais tempo para ler o erro
            });
            // Força a revalidação da lista para buscar o estado correto do banco em caso de erro
             queryClient.invalidateQueries({ queryKey: ['pedidos'] });
             queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
        },
    });
    // ====================================================================

    // Função chamada pelo PedidoCard ou pelo Drop/TouchEnd
    const handleStatusChange = (pedidoId, newStatus) => {
        const pedido = pedidos.find(p => p.id === pedidoId);
        // Só executa a mutação se o status realmente mudou
        if (pedido && pedido.status !== newStatus) {
             console.log(`Tentando mudar status do pedido ${pedidoId} de "${pedido.status}" para "${newStatus}"`); // Log para debug
            updatePedidoStatusMutation.mutate({ pedidoId, newStatus });
        } else if (pedido && pedido.status === newStatus) {
             console.log(`Pedido ${pedidoId} já está no status "${newStatus}". Nenhuma ação tomada.`); // Log informativo
        }
    };

    // Função de Duplicação (assumindo que existe e está correta)
    const handleDuplicatePedido = async (pedidoOriginal) => {
        const toastId = toast.loading('Duplicando pedido...');
        try {
            // 1. Remove ID e campos de timestamp do pedido original
            const { id, created_at, data_solicitacao, ...pedidoBase } = pedidoOriginal;

            // 2. Define o novo status e solicitante
            const novoPedidoData = {
                ...pedidoBase,
                status: 'Solicitação', // Ou o status inicial desejado
                solicitante_id: user.id,
                titulo: pedidoBase.titulo ? `${pedidoBase.titulo} (Cópia)` : `Cópia do Pedido ${id}`,
                data_solicitacao: new Date().toISOString(), // Data atual
                // Certifique-se que organizacao_id está presente
                organizacao_id: organizacaoId,
                 // Limpa campos que não devem ser copiados diretamente
                 data_entrega_prevista: null,
                 data_entrega_real: null,
                 valor_total_estimado: null, // Será recalculado talvez
            };

             // Remove a relação 'empreendimentos' se ela existir e for um objeto, pois não podemos inserir isso
             if (novoPedidoData.empreendimentos && typeof novoPedidoData.empreendimentos === 'object') {
                 delete novoPedidoData.empreendimentos;
             }
             // Remove a relação 'solicitante' se ela existir e for um objeto
             if (novoPedidoData.solicitante && typeof novoPedidoData.solicitante === 'object') {
                 delete novoPedidoData.solicitante;
             }
             // Remove 'itens' e 'anexos' do objeto principal, pois serão inseridos separadamente
             delete novoPedidoData.itens;
             delete novoPedidoData.anexos;


            // 3. Insere o novo pedido
            const { data: novoPedido, error: pedidoError } = await supabase
                .from('pedidos_compra')
                .insert(novoPedidoData)
                .select('*')
                .single();

            if (pedidoError) throw pedidoError;

            // 4. Copia os itens do pedido (se houver)
            if (pedidoOriginal.itens && pedidoOriginal.itens.length > 0) {
                const novosItens = pedidoOriginal.itens.map(item => {
                    const { id: itemId, pedido_compra_id, created_at, fornecedor, ...itemBase } = item; // Remove ID, FK e timestamp, e a relação fornecedor
                    return {
                        ...itemBase,
                        pedido_compra_id: novoPedido.id, // Associa ao novo pedido
                         organizacao_id: organizacaoId, // Garante organizacao_id nos itens
                         // Mantém o fornecedor_id se existir
                         fornecedor_id: item.fornecedor_id ? item.fornecedor_id : null,
                    };
                });
                const { error: itensError } = await supabase
                    .from('pedidos_compra_itens')
                    .insert(novosItens);
                if (itensError) {
                     // Tenta deletar o pedido recém-criado para consistência
                     await supabase.from('pedidos_compra').delete().eq('id', novoPedido.id);
                     throw itensError;
                }
            }

             // 5. Copia os anexos do pedido (se houver e fizer sentido - cuidado com referências de storage)
             // Nota: Copiar anexos pode ser complexo se envolver duplicar arquivos no storage.
             //       Aqui, vamos apenas copiar a referência se fizer sentido.
             /*
             if (pedidoOriginal.anexos && pedidoOriginal.anexos.length > 0) {
                 const novosAnexos = pedidoOriginal.anexos.map(anexo => {
                     const { id: anexoId, pedido_compra_id, created_at, ...anexoBase } = anexo;
                     return {
                         ...anexoBase,
                         pedido_compra_id: novoPedido.id,
                         organizacao_id: organizacaoId,
                         // usuario_id: user.id // Atribui ao usuário atual?
                     };
                 });
                 const { error: anexosError } = await supabase
                     .from('pedidos_compra_anexos')
                     .insert(novosAnexos);
                 // Tratar erro de anexo se necessário...
             }
             */


            toast.success('Pedido duplicado com sucesso!', { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['pedidos'] }); // Atualiza a lista
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });

        } catch (error) {
            console.error("Erro ao duplicar pedido:", error);
            toast.error(`Falha ao duplicar pedido: ${error.message}`, { id: toastId });
        }
    };


     // Ordenação
     const toggleSort = (criteria) => {
         if (sortCriteria === criteria) {
             setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
         } else {
             setSortCriteria(criteria);
             setSortDirection('asc'); // Padrão ao mudar critério
         }
     };

     // Agrupamento e Ordenação dos Pedidos
     const groupedData = useMemo(() => {
         const grouped = statusColumns.reduce((acc, column) => {
             acc[column.id] = { title: column.title, pedidos: [], valorTotal: 0 };
             return acc;
         }, {});

         pedidos.forEach(pedido => {
             const statusKey = pedido.status === 'Pedido Realizado' ? 'Solicitação' : pedido.status; // Ajuste para agrupar corretamente
             if (grouped[statusKey]) {
                 grouped[statusKey].pedidos.push(pedido);
                 // Soma valorTotal apenas se existir e for numérico
                 const valorEstimado = parseFloat(pedido.valor_total_estimado);
                 if (!isNaN(valorEstimado)) {
                     grouped[statusKey].valorTotal += valorEstimado;
                 }
             } else {
                 // Fallback para pedidos com status inesperado (opcional)
                 // console.warn(`Pedido ${pedido.id} com status inesperado: ${pedido.status}`);
                 // Poderia adicionar a uma coluna 'Outros' se quisesse
             }
         });

         // Aplica a ordenação dentro de cada coluna
         Object.keys(grouped).forEach(status => {
            grouped[status].pedidos.sort((a, b) => {
                let valA, valB;

                if (sortCriteria === 'data_solicitacao' || sortCriteria === 'data_entrega_prevista') {
                    // Trata datas - considera nulos como mais antigos ou mais recentes dependendo da direção
                    valA = a[sortCriteria] ? new Date(a[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000));
                    valB = b[sortCriteria] ? new Date(b[sortCriteria]) : (sortDirection === 'asc' ? new Date(0) : new Date(8640000000000000));
                } else if (sortCriteria === 'valor_total_estimado') {
                    // Trata valores numéricos - considera nulos/inválidos como 0
                    valA = parseFloat(a[sortCriteria]) || 0;
                    valB = parseFloat(b[sortCriteria]) || 0;
                } else {
                    // Trata como string (case-insensitive)
                    valA = a[sortCriteria]?.toString().toLowerCase() || '';
                    valB = b[sortCriteria]?.toString().toLowerCase() || '';
                }

                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
         });

        return grouped;
    }, [pedidos, sortCriteria, sortDirection]); // Agora depende dos estados de ordenação


     // Função para checar itens pendentes (fornecedor ou preço)
     const checkPendingItems = (pedido) => {
         if (!pedido || !pedido.itens || pedido.itens.length === 0) {
             return false; // Sem itens, não há pendência
         }
         return pedido.itens.some(item =>
             !item.fornecedor_id || item.preco_unitario_real === null || item.preco_unitario_real === undefined || item.preco_unitario_real <= 0
         );
     };

    // JSX do Kanban
    return (
        <div ref={scrollContainerRef} className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 relative"
             onDragOver={handleDragOver}
             // Os eventos touch são melhor gerenciados nos cards individuais para evitar conflitos com scroll
             // onTouchMove={handleTouchMove}
             // onTouchEnd={handleTouchEnd}
        >
             {/* Botão de Ordenação Flutuante */}
            <div className="sticky left-2 top-2 z-20 bg-white p-1 rounded-full shadow border flex items-center text-xs">
                <button
                    onClick={() => toggleSort('data_solicitacao')}
                    title={`Ordenar por Data da Solicitação (${sortCriteria === 'data_solicitacao' ? (sortDirection === 'asc' ? ' crescente' : ' decrescente') : ''})`}
                    className={`p-1 rounded-full ${sortCriteria === 'data_solicitacao' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FontAwesomeIcon icon={faSort} rotation={sortCriteria === 'data_solicitacao' && sortDirection === 'desc' ? 180 : 0}/> Data Sol.
                </button>
                 <button
                    onClick={() => toggleSort('data_entrega_prevista')}
                    title={`Ordenar por Data Prev. Entrega (${sortCriteria === 'data_entrega_prevista' ? (sortDirection === 'asc' ? ' crescente' : ' decrescente') : ''})`}
                    className={`p-1 rounded-full ${sortCriteria === 'data_entrega_prevista' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FontAwesomeIcon icon={faSort} rotation={sortCriteria === 'data_entrega_prevista' && sortDirection === 'desc' ? 180 : 0}/> Data Ent.
                </button>
                {/* Adicione mais botões de ordenação se necessário (ex: por valor) */}
            </div>

            {statusColumns.map(column => {
                 const columnData = groupedData[column.id] || { title: column.title, pedidos: [], valorTotal: 0 };
                 const valorTotalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(columnData.valorTotal);

                return (
                    <div
                        key={column.id}
                        data-column-id={column.id} // Importante para o touchmove
                        className={`bg-gray-100 rounded-lg shadow-md w-72 flex-shrink-0 flex flex-col border-t-4 transition-colors duration-200 ${dragOverColumn === column.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        onDragEnter={(e) => handleDragEnter(e, column.id)}
                        onDragLeave={() => setDragOverColumn(null)} // Limpa ao sair
                        onDragEnd={handleDragEnd} // Garante limpeza no fim do drag
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
                                // Ajusta o status para exibição, se necessário
                                const displayStatus = pedido.status; // Não precisa mais ajustar 'Pedido Realizado' para 'Solicitação' aqui, o agrupamento já fez isso.
                                // Verifica pendências (usando a função auxiliar)
                                const hasPendingInvoice = pedido.status === 'Realizado' && (!pedido.anexos || !pedido.anexos.some(anexo => anexo.descricao === 'Nota Fiscal'));
                                const hasPendingItems = ['Em Cotação', 'Em Negociação', 'Revisão do Responsável'].includes(displayStatus) && checkPendingItems(pedido);

                                return (
                                    <PedidoCard
                                        key={pedido.id}
                                        pedido={{...pedido, status: displayStatus}} // Passa o status correto para o card
                                        onStatusChange={handleStatusChange}
                                        onDuplicate={handleDuplicatePedido}
                                        allStatusColumns={statusColumns.map(s => s.id)}
                                        hasPendingInvoice={hasPendingInvoice}
                                        hasPendingItems={hasPendingItems}
                                        onCardClick={onCardClick}
                                        // Adiciona handlers de drag/touch
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, pedido)}
                                        onTouchStart={(e) => handleTouchStart(e, pedido)}
                                         // Adiciona data attribute para touchmove e dragend
                                        data-pedido-id={pedido.id}
                                        // Adiciona listeners touchmove/end diretamente aqui pode ser mais confiável
                                         onTouchMove={handleTouchMove}
                                         onTouchEnd={handleTouchEnd}
                                    />
                                );
                            })}
                            {/* Feedback visual enquanto arrasta sobre a coluna */}
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