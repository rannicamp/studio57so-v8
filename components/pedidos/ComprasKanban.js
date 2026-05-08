// components/pedidos/ComprasKanban.js
"use client";

import { useMemo, useState, useRef, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import PedidoCard from './PedidoCard';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSpinner, faTrash, faPencilAlt, faPlus, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { notificarGrupo } from '@/utils/notificacoes';

export default function ComprasKanban({ 
  pedidos, 
  fases = [], 
  onCardClick,
  onDeleteAllCanceled, 
  canDelete, 
  isDeleting,
  onCreateColumn,
  onEditColumn,
  onDeleteColumn,
  onReorderColumns
}) {
 const supabase = createClient();
 const { user } = useAuth();
 const queryClient = useQueryClient();
 
 const [draggedPedido, setDraggedPedido] = useState(null);
 const [dragOverColumn, setDragOverColumn] = useState(null);
 
 const [draggedColumn, setDraggedColumn] = useState(null);
 const [dragOverCol, setDragOverCol] = useState(null);
 
 const [sorting, setSorting] = useState({});
 const [openSortMenu, setOpenSortMenu] = useState(null);
 const sortMenuRef = useRef(null);
 const scrollContainerRef = useRef(null);
 const [isDraggingScroll, setIsDraggingScroll] = useState(false);
 const [startX, setStartX] = useState(0);
 const [scrollLeft, setScrollLeft] = useState(0);
 const [deletingColumnId, setDeletingColumnId] = useState(null);
 
 const [editingColumnId, setEditingColumnId] = useState(null);
 const [editColumnName, setEditColumnName] = useState('');
 const [isCreatingColumn, setIsCreatingColumn] = useState(false);
 const [newColumnName, setNewColumnName] = useState('');

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

 const updateStatusMutation = useMutation({
   mutationFn: async ({ pedidoId, newFaseId, newStatusNome }) => {
     const { error } = await supabase
       .from('pedidos_compra')
       .update({ fase_id: newFaseId, status: newStatusNome })
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
     const { id, created_at, updated_at, data_solicitacao, status, fase_id,
       anexos, itens: itensMemoria, solicitante, empreendimentos, historico, lancamentos,
       ...rest } = pedidoOriginal;
     const faseInicial = fases[0];
     const novoPedido = {
       ...rest,
       titulo: `${pedidoOriginal.titulo || 'Pedido'} (Cópia)`,
       status: faseInicial ? faseInicial.nome : 'Solicitação',
       fase_id: faseInicial ? faseInicial.id : null,
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

     const { data: itensOriginais, error: erroItens } = await supabase
       .from('pedidos_compra_itens')
       .select('descricao_item, quantidade_solicitada, unidade_medida, fornecedor_id, preco_unitario_real, custo_total_real, etapa_id, subetapa_id, tipo_operacao, dias_aluguel, material_id, orcamento_item_id, organizacao_id')
       .eq('pedido_compra_id', id);

     if (erroItens) throw new Error(`Pedido duplicado, mas falha ao ler itens: ${erroItens.message}`);

     if (itensOriginais && itensOriginais.length > 0) {
       const itensParaCopiar = itensOriginais.map(item => ({
         ...item,
         pedido_compra_id: pedidoCriado.id,
         organizacao_id: user.organizacao_id,
       }));
       const { error: erroInsertItens } = await supabase.from('pedidos_compra_itens').insert(itensParaCopiar);
       if (erroInsertItens) throw new Error(`Pedido duplicado, mas falha ao copiar itens: ${erroInsertItens.message}`);
     }
     return { pedidoCriado, qtdItens: itensOriginais?.length || 0 };
   },
   onSuccess: ({ qtdItens }) => {
     queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
     toast.success(`Pedido duplicado com sucesso! (${qtdItens} iten${qtdItens !== 1 ? 's' : ''} copiado${qtdItens !== 1 ? 's' : ''})`);
   },
   onError: (error) => toast.error(`Erro ao duplicar: ${error.message}`)
 });

 const handleMouseDown = (e) => { 
   if (e.target.closest('.kanban-card') || e.target.closest('.col-header') || e.target.closest('button') || e.target.closest('input')) return; 
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

 const sortOptions = [
   { value: '', label: 'Padrão' },
   { value: 'titulo_asc', label: 'Nome (A-Z)' },
   { value: 'titulo_desc', label: 'Nome (Z-A)' },
   { value: 'data_entrega_prevista_asc', label: 'Entrega (Mais Próxima)' },
   { value: 'data_entrega_prevista_desc', label: 'Entrega (Mais Distante)' },
   { value: 'data_solicitacao_desc', label: 'Solicitação (Mais Recente)' },
   { value: 'data_solicitacao_asc', label: 'Solicitação (Mais Antiga)' },
 ];

 const calculaTotalColuna = (pedidosColuna) => {
   if (!pedidosColuna) return 0;
   return pedidosColuna.reduce((acc, pedido) => {
     const itens = pedido.itens || [];
     const totalItens = itens.reduce((soma, item) => soma + (parseFloat(item.custo_total_real) || 0), 0);
     return acc + totalItens;
   }, 0);
 };

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

 const pedidosPorColuna = useMemo(() => {
   const grouped = {};
   fases.forEach(fase => {
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
 }, [pedidos, sorting, fases]);

 // Pedido Drag & Drop
 const handleDragStart = (e, pedido) => { setDraggedPedido(pedido); e.dataTransfer.effectAllowed = 'move'; };
 const handleDragOver = (e, columnId) => { e.preventDefault(); setDragOverColumn(columnId); };
 const handleDrop = (e, targetFaseId) => {
   e.preventDefault();
   setDragOverColumn(null);
   if (!draggedPedido) return;
   if (draggedPedido.fase_id === targetFaseId) return;
   const targetFase = fases.find(f => f.id === targetFaseId);
   updateStatusMutation.mutate({ pedidoId: draggedPedido.id, newFaseId: targetFaseId, newStatusNome: targetFase?.nome || 'Desconhecido' });
   setDraggedPedido(null);
 };
 
 // Column Drag & Drop
 const handleColDragStart = (e, fase) => {
   // Prevent dragging column if user is dragging a card
   if (e.target.closest('.kanban-card') && !e.target.closest('.col-header')) return;
   setDraggedColumn(fase);
   e.dataTransfer.effectAllowed = 'move';
 };
 const handleColDragOver = (e, targetFase) => {
   e.preventDefault();
   if (draggedColumn && draggedColumn.id !== targetFase.id) {
       setDragOverCol(targetFase.id);
   }
 };
 const handleColDrop = (e, targetFase) => {
   e.preventDefault();
   setDragOverCol(null);
   if (!draggedColumn || draggedColumn.id === targetFase.id) return;
   
   const newFases = [...fases];
   const fromIndex = newFases.findIndex(f => f.id === draggedColumn.id);
   const toIndex = newFases.findIndex(f => f.id === targetFase.id);
   
   newFases.splice(fromIndex, 1);
   newFases.splice(toIndex, 0, draggedColumn);
   
   const updatedCols = newFases.map((f, i) => ({ id: f.id, ordem: i + 1 }));
   if (onReorderColumns) {
       onReorderColumns(updatedCols);
   }
   setDraggedColumn(null);
 };

 const handleDeleteAll = (columnId) => {
   const pedidosParaDeletar = pedidosPorColuna[columnId];
   if (!pedidosParaDeletar || pedidosParaDeletar.length === 0) return;
   toast("Excluir Todos os Pedidos", { description: `Tem certeza que deseja excluir permanentemente os ${pedidosParaDeletar.length} pedidos desta coluna?`, action: { label: "Excluir Tudo", onClick: () => { setDeletingColumnId(columnId); const idsParaDeletar = pedidosParaDeletar.map(p => p.id); onDeleteAllCanceled(idsParaDeletar); }, }, cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }, });
 };
 
 const handleDeleteColumn = (faseId) => {
   const colPedidos = pedidosPorColuna[faseId] || [];
   if (colPedidos.length > 0) {
       toast.error("Não é possível excluir uma fase que contém pedidos. Mova os pedidos primeiro.");
       return;
   }
   if (window.confirm("Deseja realmente excluir esta fase do Kanban?")) {
       onDeleteColumn && onDeleteColumn(faseId);
   }
 };

 const handleSaveEditColumn = () => {
   if (editColumnName.trim() === '') return;
   onEditColumn && onEditColumn(editingColumnId, editColumnName.trim());
   setEditingColumnId(null);
 };

 const handleSaveNewColumn = () => {
   if (newColumnName.trim() === '') {
       setIsCreatingColumn(false);
       return;
   }
   onCreateColumn && onCreateColumn(newColumnName.trim());
   setNewColumnName('');
   setIsCreatingColumn(false);
 };

 return (
   <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto p-4 h-full bg-gray-100 cursor-grab min-h-[calc(100vh-200px)]" onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeaveOrUp} onMouseUp={handleMouseLeaveOrUp} onMouseMove={handleMouseMove}>
     {fases.map(fase => (
       <div key={fase.id} 
         className={`w-80 flex-shrink-0 bg-white rounded-lg shadow-sm flex flex-col transition-all duration-200 ${dragOverCol === fase.id ? 'opacity-50 ring-2 ring-blue-500 scale-105' : ''}`}
         draggable={!editingColumnId}
         onDragStart={(e) => handleColDragStart(e, fase)}
         onDragOver={(e) => {
            if (draggedColumn) handleColDragOver(e, fase);
            else handleDragOver(e, fase.id);
         }}
         onDrop={(e) => {
            if (draggedColumn) handleColDrop(e, fase);
            else handleDrop(e, fase.id);
         }}
       >
         <div className="col-header p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex flex-col cursor-move hover:bg-gray-100 transition-colors group">
           
           {editingColumnId === fase.id ? (
              <div className="flex items-center w-full gap-2 mb-1">
                  <input 
                      type="text" 
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={editColumnName} 
                      onChange={e => setEditColumnName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSaveEditColumn()}
                  />
                  <button onClick={handleSaveEditColumn} className="text-green-600 hover:text-green-800 p-1"><FontAwesomeIcon icon={faCheck} /></button>
                  <button onClick={() => setEditingColumnId(null)} className="text-red-500 hover:text-red-700 p-1"><FontAwesomeIcon icon={faTimes} /></button>
              </div>
           ) : (
              <div className="flex justify-between items-center w-full mb-1">
                 <div className="flex items-center gap-2 flex-1">
                     <span className="truncate flex-1 max-w-[180px]">{fase.nome}</span>
                     <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                     {pedidosPorColuna[fase.id]?.length || 0}
                     </span>
                 </div>
                 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => { setEditColumnName(fase.nome); setEditingColumnId(fase.id); }} className="text-gray-400 hover:text-blue-600 p-1" title="Renomear">
                         <FontAwesomeIcon icon={faPencilAlt} />
                     </button>
                     <button onClick={() => handleDeleteColumn(fase.id)} className="text-gray-400 hover:text-red-600 p-1" title="Excluir Coluna">
                         <FontAwesomeIcon icon={faTrash} />
                     </button>
                 </div>
              </div>
           )}

           <div className="flex justify-between items-center w-full">
              <span className="text-xs text-gray-500 font-normal" title="Valor total dos itens na coluna">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculaTotalColuna(pedidosPorColuna[fase.id]))}
              </span>

              <div className="flex items-center gap-3">
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
                     <div ref={sortMenuRef} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 text-left cursor-default">
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
         </div>

         <div className={`kanban-card p-2 flex-1 overflow-y-auto space-y-3 min-h-[100px] ${dragOverColumn === fase.id && !draggedColumn ? 'bg-blue-50/50' : ''}`}>
           {pedidosPorColuna[fase.id]?.map(pedido => (
             <div key={pedido.id} draggable onDragStart={(e) => handleDragStart(e, pedido)} className="cursor-move active:cursor-grabbing">
               <PedidoCard 
                 pedido={pedido} 
                 allStatusColumns={fases.map(c => c.nome)} 
                 onStatusChange={(pid, newStatus) => {
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

     {/* COLUNA ADICIONAR NOVA FASE */}
     <div className="w-80 flex-shrink-0 bg-transparent flex flex-col justify-start">
         {isCreatingColumn ? (
             <div className="bg-white rounded-lg shadow-sm p-3 border border-blue-200 flex flex-col gap-2">
                 <input 
                     type="text" 
                     placeholder="Nome da etapa..."
                     autoFocus
                     className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                     value={newColumnName}
                     onChange={e => setNewColumnName(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleSaveNewColumn()}
                 />
                 <div className="flex gap-2 justify-end">
                     <button onClick={() => setIsCreatingColumn(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                     <button onClick={handleSaveNewColumn} className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium">Salvar</button>
                 </div>
             </div>
         ) : (
             <button 
                 onClick={() => setIsCreatingColumn(true)}
                 className="w-full bg-gray-200 hover:bg-gray-300 text-gray-600 font-medium py-3 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors border border-dashed border-gray-400"
             >
                 <FontAwesomeIcon icon={faPlus} />
                 Adicionar Etapa
             </button>
         )}
     </div>
   </div>
 );
}