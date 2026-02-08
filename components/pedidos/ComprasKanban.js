// components/pedidos/ComprasKanban.js
"use client";

import { useMemo, useState, useRef, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import PedidoCard from './PedidoCard';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { notificarGrupo } from '@/utils/notificacoes';

export default function ComprasKanban({ 
    pedidos, 
    fases = [], // Agora recebemos as fases como prop
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

    // Mutation Atualizada: Atualiza fase_id E status para manter compatibilidade
    const updateStatusMutation = useMutation({
        mutationFn: async ({ pedidoId, newFaseId, newStatusNome }) => {
            const { error } = await supabase
                .from('pedidos_compra')
                .update({ 
                    fase_id: newFaseId,
                    status: newStatusNome // Atualizamos o texto também para compatibilidade
                })
                .eq('id', pedidoId);
            if (error) throw error;
            return { pedidoId, newStatusNome };
        },
        onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
            toast.success('Fase atualizada!');

            if (result.newStatusNome === 'Entregue') {
                const pedidoInfo = pedidos.find(p => p.id === result.pedidoId);
                const tituloPedido = pedidoInfo?.titulo || 'Pedido sem título';
                await notificarGrupo({
                    permissao: 'pedidos',
                    titulo: '✅ Entrega Confirmada!',
                    mensagem: `O Pedido #${result.pedidoId} (${tituloPedido}) foi marcado como Entregue.`,
                    link: `/pedidos/${result.pedidoId}`,
                    tipo: 'sucesso',
                    organizacaoId: user.organizacao_id
                });
            }
        },
        onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`)
    });

    const duplicatePedidoMutation = useMutation({
        mutationFn: async (pedidoOriginal) => {
            // CORREÇÃO: Removemos propriedades relacionais (objetos/arrays) que não são colunas diretas
            const { 
                id, 
                created_at, 
                updated_at, 
                data_solicitacao, 
                status, 
                fase_id, 
                // Removemos estes campos extras para evitar o erro "Column not found":
                anexos,
                itens,
                solicitante,
                empreendimentos,
                historico,
                lancamentos,
                ...rest 
            } = pedidoOriginal;
            
            // Pega a primeira fase (Solicitação) para a cópia
            const faseInicial = fases[0];
            
            const novoPedido = {
                ...rest,
                titulo: `${pedidoOriginal.titulo} (Cópia)`,
                status: faseInicial ? faseInicial.nome : 'Solicitação',
                fase_id: faseInicial ? faseInicial.id : null,
                data_solicitacao: new Date().toISOString(),
                solicitante_id: user.id,
                organizacao_id: user.organizacao_id
            };

            const { data: pedidoCriado, error: erroPedido } = await supabase.from('pedidos_compra').insert(novoPedido).select().single();
            if (erroPedido) throw erroPedido;

            if (pedidoOriginal.itens && pedidoOriginal.itens.length > 0) {
                const itensParaCopiar = pedidoOriginal.itens.map(item => {
                    // Também removemos relacionamentos dos itens antes de copiar
                    const { 
                        id, 
                        pedido_compra_id, 
                        created_at, 
                        fornecedor, // remove objeto fornecedor
                        etapa,      // remove objeto etapa
                        ...itemRest 
                    } = item;
                    
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

    // ... (Scroll logic mantida igual) ...
    const handleMouseDown = (e) => { if (e.target.closest('.kanban-card') || e.target.closest('button')) return; setIsDraggingScroll(true); const container = scrollContainerRef.current; setStartX(e.pageX - container.offsetLeft); setScrollLeft(container.scrollLeft); container.style.cursor = 'grabbing'; };
    const handleMouseLeaveOrUp = () => { if (!isDraggingScroll) return; setIsDraggingScroll(false); if (scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab'; };
    const handleMouseMove = (e) => { if (!isDraggingScroll) return; e.preventDefault(); const container = scrollContainerRef.current; const x = e.pageX - container.offsetLeft; const walk = (x - startX); container.scrollLeft = scrollLeft - walk; };

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
        if (!sortValue) { const newSorting = { ...sorting }; delete newSorting[colunaId]; setSorting(newSorting); } 
        else { const lastUnderscoreIndex = sortValue.lastIndexOf('_'); const sortBy = sortValue.substring(0, lastUnderscoreIndex); const order = sortValue.substring(lastUnderscoreIndex + 1); setSorting(prev => ({ ...prev, [colunaId]: { sortBy, order } })); }
        setOpenSortMenu(null);
    };

    // Agrupa Pedidos por FASE_ID (Dinâmico)
    const pedidosPorColuna = useMemo(() => {
        const grouped = {};
        fases.forEach(fase => {
            // Filtra pelo UUID da fase
            const pedidosDaColuna = [...pedidos.filter(p => p.fase_id === fase.id)];
            
            const sortConfig = sorting[fase.id];
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
            grouped[fase.id] = pedidosDaColuna;
        });
        return grouped;
    }, [pedidos, sorting, fases]); // Dependência adicionada: fases

    const handleDragStart = (e, pedido) => { setDraggedPedido(pedido); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e, columnId) => { e.preventDefault(); setDragOverColumn(columnId); };
    
    const handleDrop = (e, targetFaseId) => {
        e.preventDefault();
        setDragOverColumn(null);
        if (!draggedPedido) return;
        if (draggedPedido.fase_id === targetFaseId) return; // Verifica pelo ID
        
        // Encontra o nome da fase para manter compatibilidade
        const targetFase = fases.find(f => f.id === targetFaseId);
        
        updateStatusMutation.mutate({ 
            pedidoId: draggedPedido.id, 
            newFaseId: targetFaseId,
            newStatusNome: targetFase?.nome || 'Desconhecido'
        });
        setDraggedPedido(null);
    };

    const handleDeleteAll = (columnId) => {
        const pedidosParaDeletar = pedidosPorColuna[columnId];
        if (!pedidosParaDeletar || pedidosParaDeletar.length === 0) return;
        toast("Excluir Todos os Pedidos", { description: `Tem certeza que deseja excluir permanentemente os ${pedidosParaDeletar.length} pedidos desta coluna?`, action: { label: "Excluir Tudo", onClick: () => { setDeletingColumnId(columnId); const idsParaDeletar = pedidosParaDeletar.map(p => p.id); onDeleteAllCanceled(idsParaDeletar); }, }, cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }, });
    };

    // Renderiza usando o array FASES dinâmico
    return (
        <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto p-4 h-full bg-gray-100 cursor-grab min-h-[calc(100vh-200px)]" onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeaveOrUp} onMouseUp={handleMouseLeaveOrUp} onMouseMove={handleMouseMove}>
            {fases.map(fase => (
                <div 
                    key={fase.id} // Chave é o UUID
                    className="w-80 flex-shrink-0 bg-white rounded-lg shadow-sm flex flex-col kanban-card"
                    onDragOver={(e) => handleDragOver(e, fase.id)}
                    onDrop={(e) => handleDrop(e, fase.id)}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span>{fase.nome}</span>
                            <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                                {pedidosPorColuna[fase.id]?.length || 0}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {/* Botão de Excluir apenas para fases marcadas como "finalizado" e nome "Cancelado" (ou lógica específica) */}
                            {canDelete && fase.nome === 'Cancelado' && (pedidosPorColuna[fase.id]?.length || 0) > 0 && (
                                <button onClick={() => handleDeleteAll(fase.id)} disabled={deletingColumnId === fase.id} className="text-red-400 hover:text-red-600 transition-colors">
                                    <FontAwesomeIcon icon={deletingColumnId === fase.id ? faSpinner : faTrash} spin={deletingColumnId === fase.id} />
                                </button>
                            )}

                            <div className="relative">
                                <button onClick={() => setOpenSortMenu(openSortMenu === fase.id ? null : fase.id)} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                                    <FontAwesomeIcon icon={faSort} />
                                </button>
                                {openSortMenu === fase.id && (
                                    <div ref={sortMenuRef} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 text-left">
                                        <p className="p-2 font-semibold text-xs text-gray-500 border-b bg-gray-50">Ordenar por:</p>
                                        {sortOptions.map(option => (
                                            <button key={option.value} onClick={() => handleSortChange(fase.id, option.value)} className={`block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${(sorting[fase.id] && `${sorting[fase.id].sortBy}_${sorting[fase.id].order}` === option.value) || (!sorting[fase.id] && option.value === '') ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'}`}>
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`p-2 flex-1 overflow-y-auto space-y-3 min-h-[100px] ${dragOverColumn === fase.id ? 'bg-blue-50/50' : ''}`}>
                        {pedidosPorColuna[fase.id]?.map(pedido => (
                            <div key={pedido.id} draggable onDragStart={(e) => handleDragStart(e, pedido)} className="cursor-move active:cursor-grabbing">
                                <PedidoCard 
                                    pedido={pedido} 
                                    // Passamos as opções de menu (Texto) para o card, se precisar
                                    allStatusColumns={fases.map(c => c.nome)} 
                                    onStatusChange={(pid, newStatus) => {
                                        // O card retorna o NOME do status. Precisamos achar o ID.
                                        const targetFase = fases.find(f => f.nome === newStatus);
                                        if (targetFase) {
                                            updateStatusMutation.mutate({ pedidoId: pid, newFaseId: targetFase.id, newStatusNome: newStatus });
                                        }
                                    }}
                                    onDuplicate={() => duplicatePedidoMutation.mutate(pedido)}
                                    onCardClick={onCardClick}
                                />
                            </div>
                        ))}
                        {pedidosPorColuna[fase.id]?.length === 0 && (
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