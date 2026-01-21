// Caminho: components/crm/FunilKanban.js
"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react';
import ContatoCardCRM from './ContatoCardCRM';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSort, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { enviarNotificacao } from '@/utils/notificacoes';
import { useAuth } from '@/contexts/AuthContext';

// --- IMPORTAÇÃO DO CAPI (NOVO) ---
import { verificarDisparoCapi } from '@/app/(main)/crm/capiActions';

const AddColumn = ({ onCreate }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");

    const createColumnMutation = useMutation({
        mutationFn: async (columnName) => {
            if (!columnName.trim()) throw new Error("O nome da etapa não pode ser vazio.");
            await onCreate(columnName);
        },
        onSuccess: () => {
            setNewColumnName("");
            setIsCreating(false);
        },
    });

    const handleSave = () => {
        toast.promise(createColumnMutation.mutateAsync(newColumnName), {
            loading: 'Criando nova etapa...',
            success: 'Etapa criada com sucesso!',
            error: (err) => err.message
        });
    };

    return (
        <div className="w-80 flex-shrink-0">
            {isCreating ? (
                <div className="p-3 bg-gray-200 rounded-lg">
                    <input type="text" placeholder="Nome da nova etapa" className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} autoFocus />
                    <div className="flex gap-2 justify-end">
                        <button className="px-3 py-1 rounded text-sm" onClick={() => setIsCreating(false)} disabled={createColumnMutation.isPending}>Cancelar</button>
                        <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400" onClick={handleSave} disabled={createColumnMutation.isPending}>
                            {createColumnMutation.isPending ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </div>
            ) : (
                <button className="w-full h-16 flex items-center justify-center gap-2 text-gray-600 font-medium bg-white/30 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors hover:bg-white/70 hover:text-gray-800" onClick={() => setIsCreating(true)}>
                    <FontAwesomeIcon icon={faPlus} /> Adicionar Etapa
                </button>
            )}
        </div>
    );
};


export default function FunilKanban({
    contatos,
    statusColumns,
    onStatusChange,
    onCreateColumn,
    onAddContact,
    onEditColumn,
    onDeleteColumn,
    onReorderColumns,
    onOpenNotesModal,
    availableProducts,
    onAssociateProduct,
    onDissociateProduct,
    onAssociateCorretor,
    onCardClick,
    onAddActivity,
    sorting,
    setSorting,
    userRole,
    onDeleteAllCardsInColumn,
    onDeleteCard,
    onStartWhatsApp
}) {
    const { user } = useAuth();
    const [editingColumnId, setEditingColumnId] = useState(null);
    const [editedColumnName, setEditedColumnName] = useState("");
    const [draggedItem, setDraggedItem] = useState(null);
    const [openSortMenu, setOpenSortMenu] = useState(null);
    const sortMenuRef = useRef(null);
    const [deletingColumnId, setDeletingColumnId] = useState(null);
    
    const [dragOverColumnId, setDragOverColumnId] = useState(null);
    
    const scrollContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const protectedColumns = ['excluir', 'vendido', 'perdido'];

    useEffect(() => {
        function handleClickOutside(event) {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
                setOpenSortMenu(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [sortMenuRef]);

    const handleMouseDown = (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('button') || e.target.closest('input')) return;
        setIsDragging(true);
        const container = scrollContainerRef.current;
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
    };

    const handleMouseLeaveOrUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const container = scrollContainerRef.current;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX); 
        container.scrollLeft = scrollLeft - walk;
    };

    const handleDragStart = (e, item, type) => {
        e.stopPropagation();
        setDraggedItem({ item, type });
        if (type === 'card') {
            e.dataTransfer.setData("contatoNoFunilId", item.id);
        } else if (type === 'column') {
            e.dataTransfer.setData("draggedColumnId", item.id);
        }
    };

    const handleDragOver = (e, colunaId) => { 
        e.preventDefault(); 
        if (draggedItem && draggedItem.type === 'card' && draggedItem.item.coluna_id !== colunaId) {
            setDragOverColumnId(colunaId);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverColumnId(null);
    };

    const handleDrop = async (e, targetColumn) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverColumnId(null);

        if (!draggedItem) return;
        
        // Lógica de Colunas
        if (draggedItem.type === 'column' && draggedItem.item.id !== targetColumn.id) {
            const draggedIndex = statusColumns.findIndex(col => col.id === draggedItem.item.id);
            const targetIndex = statusColumns.findIndex(col => col.id === targetColumn.id);
            if (draggedIndex === -1 || targetIndex === -1) return;
            const newColumns = Array.from(statusColumns);
            const [draggedColumn] = newColumns.splice(draggedIndex, 1);
            newColumns.splice(targetIndex, 0, draggedColumn);
            const reorderedWithNewOrder = newColumns.map((col, index) => ({ ...col, ordem: index }));
            onReorderColumns(reorderedWithNewOrder);
        }
        
        // Lógica de Cards (Leads)
        if (draggedItem.type === 'card' && draggedItem.item.coluna_id !== targetColumn.id) {
            // 1. Atualiza visualmente e no banco (Função Original)
            await onStatusChange(draggedItem.item.id, targetColumn.id);

            // 2. --- DISPARO DO CAPI (Meta/Facebook) ---
            // Chamamos a Server Action em background (sem await) para não travar a UI
            verificarDisparoCapi(draggedItem.item.id, targetColumn.id);
            
            // 3. Notificação Interna do Sistema
            const nomeContato = draggedItem.item.contatos?.nome || draggedItem.item.contatos?.razao_social || 'Contato';
            const nomeOrigem = statusColumns.find(c => c.id === draggedItem.item.coluna_id)?.nome || '?';
            
            await enviarNotificacao({
                userId: user.id,
                titulo: "🚀 Movimentação no Funil",
                mensagem: `${nomeContato} mudou de "${nomeOrigem}" para "${targetColumn.nome}".`,
                link: '/crm',
                organizacaoId: user.organizacao_id,
                canal: 'comercial'
            });
        }
        setDraggedItem(null);
    };

    const handleEditClick = (coluna) => { setEditingColumnId(coluna.id); setEditedColumnName(coluna.nome); };
    const handleSaveEdit = async (columnId) => { if (!editedColumnName.trim()) return; await onEditColumn(columnId, editedColumnName); setEditingColumnId(null); setEditedColumnName(""); };
    const handleCancelEdit = () => { setEditingColumnId(null); setEditedColumnName(""); };
    
    const handleDeleteClick = (columnId, columnName) => {
        toast("Confirmar Exclusão da Etapa", {
            description: `Tem certeza que deseja deletar a etapa "${columnName}"? Todos os contatos nela serão movidos para a primeira etapa.`,
            action: { label: "Excluir Etapa", onClick: () => onDeleteColumn(columnId) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' },
        });
    };
    
    const handleDeleteAll = (columnId, count) => {
        toast("Excluir Todos os Cards", {
            description: `Tem certeza que deseja excluir permanentemente os ${count} cards desta coluna? Esta ação não pode ser desfeita.`,
            action: { label: "Excluir Tudo", onClick: async () => { setDeletingColumnId(columnId); await onDeleteAllCardsInColumn(columnId); setDeletingColumnId(null); } },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' },
        });
    };
    
    const handleMoveCardFromDropdown = (contatoNoFunilId, newColumnId) => { 
        onStatusChange(contatoNoFunilId, newColumnId);
        // Também aciona o CAPI pelo dropdown
        verificarDisparoCapi(contatoNoFunilId, newColumnId);
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
   
    const sortOptions = [
        { value: '', label: 'Padrão (Mais Recentes)' }, 
        { value: 'nome_asc', label: 'Nome (A-Z)' }, 
        { value: 'nome_desc', label: 'Nome (Z-A)' }, 
        { value: 'created_at_asc', label: 'Entrada (Mais Antigo)' },
    ];

    const contatosPorColuna = useMemo(() => {
        const grouped = {};
        if (statusColumns && contatos) {
            statusColumns.forEach(coluna => {
                const contatosDaColuna = [...contatos.filter(c => c.coluna_id === coluna.id)];
                const sortConfig = sorting[coluna.id];
                if (sortConfig) {
                    contatosDaColuna.sort((a, b) => {
                        const { sortBy, order } = sortConfig;
                        let valA, valB;
                        if (sortBy === 'nome') { 
                            valA = a.contatos?.nome || a.contatos?.razao_social || null; 
                            valB = b.contatos?.nome || b.contatos?.razao_social || null; 
                        } else if (sortBy === 'created_at') { 
                            valA = a[sortBy] ? new Date(a[sortBy]) : null; 
                            valB = b[sortBy] ? new Date(b[sortBy]) : null; 
                        }
                        if (valA === valB) return 0; if (valA === null) return 1; if (valB === null) return -1;
                        const direction = order === 'asc' ? 1 : -1;
                        if (typeof valA === 'string') { return valA.localeCompare(valB) * direction; }
                        if (valA instanceof Date) { return (valA - valB) * direction; }
                        return 0;
                    });
                } else {
                    contatosDaColuna.sort((a, b) => {
                        const dateA = new Date(a.created_at);
                        const dateB = new Date(b.created_at);
                        return dateB - dateA;
                    });
                }
                grouped[coluna.id] = contatosDaColuna;
            });
        }
        return grouped;
    }, [contatos, statusColumns, sorting]);

    return (
        <div 
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto p-4 h-full bg-gray-100 cursor-grab"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
        >
            {statusColumns.map((coluna) => (
                <div 
                    key={coluna.id} 
                    className={`w-80 flex-shrink-0 bg-white rounded-lg shadow-sm flex flex-col kanban-card transition-colors duration-200 ${dragOverColumnId === coluna.id ? 'bg-blue-50 border-2 border-blue-400' : ''}`} 
                    onDragOver={(e) => handleDragOver(e, coluna.id)} 
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, coluna)}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center cursor-move" draggable onDragStart={(e) => handleDragStart(e, coluna, 'column')} onDragEnd={() => setDraggedItem(null)}>
                        {editingColumnId === coluna.id ? (
                            <div className="flex w-full items-center gap-2">
                                <input type="text" value={editedColumnName} onChange={(e) => setEditedColumnName(e.target.value)} className="flex-grow p-1 border rounded text-sm" autoFocus onKeyPress={(e) => { if (e.key === 'Enter') handleSaveEdit(coluna.id); }} />
                                <button onClick={() => handleSaveEdit(coluna.id)} className="text-blue-600 hover:text-blue-800">Salvar</button>
                                <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-800">Cancelar</button>
                            </div>
                        ) : (
                            <>
                                <h3 className="flex-grow">{coluna.nome} ({contatosPorColuna[coluna.id]?.length || 0})</h3>
                                <div className="flex items-center gap-2">
                                    {userRole === 'Proprietário' && coluna.nome.trim().toLowerCase() === 'excluir' && (contatosPorColuna[coluna.id]?.length || 0) > 0 && (
                                        <button onClick={() => handleDeleteAll(coluna.id, contatosPorColuna[coluna.id].length)} disabled={deletingColumnId === coluna.id} className="text-red-500 hover:text-red-700 transition-colors" title={`Excluir todos os ${contatosPorColuna[coluna.id].length} cards`}>
                                            <FontAwesomeIcon icon={deletingColumnId === coluna.id ? faSpinner : faTrash} spin={deletingColumnId === coluna.id} size="sm" />
                                        </button>
                                    )}
                                    <div className="relative">
                                        <button onClick={() => setOpenSortMenu(openSortMenu === coluna.id ? null : coluna.id)} className="text-gray-500 hover:text-blue-600 transition-colors" title="Ordenar cards"><FontAwesomeIcon icon={faSort} size="sm" /></button>
                                        {openSortMenu === coluna.id && (
                                            <div ref={sortMenuRef} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                                <p className="p-2 font-semibold text-xs text-gray-500 border-b">Ordenar por:</p>
                                                {sortOptions.map(option => (<button key={option.value} onClick={() => handleSortChange(coluna.id, option.value)} className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">{option.label}</button>))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleEditClick(coluna)} className="text-gray-500 hover:text-blue-600 transition-colors" title="Editar etapa"><FontAwesomeIcon icon={faEdit} size="sm" /></button>
                                    {!protectedColumns.includes(coluna.nome.trim().toLowerCase()) && (
                                        <button onClick={() => handleDeleteClick(coluna.id, coluna.nome)} className="text-gray-500 hover:text-red-600 transition-colors" title="Excluir etapa"><FontAwesomeIcon icon={faTrash} size="sm" /></button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-2 space-y-3 overflow-y-auto flex-1 bg-gray-100/50">
                        {(contatosPorColuna[coluna.id] || []).map((contato) => (
                            <ContatoCardCRM
                                key={contato.id}
                                funilEntry={contato}
                                onDragStart={(e) => handleDragStart(e, contato, 'card')}
                                onDragEnd={() => setDraggedItem(null)}
                                allColumns={statusColumns}
                                onMoveToColumn={handleMoveCardFromDropdown}
                                onOpenNotesModal={onOpenNotesModal}
                                availableProducts={availableProducts}
                                onAssociateProduct={onAssociateProduct}
                                onDissociateProduct={onDissociateProduct}
                                onAssociateCorretor={onAssociateCorretor}
                                onCardClick={onCardClick}
                                onAddActivity={onAddActivity}
                                onDeleteCard={onDeleteCard}
                                onStartWhatsApp={onStartWhatsApp}
                            />
                        ))}
                    </div>
                    <div className="p-2 border-t mt-auto">
                        <button onClick={() => onAddContact(coluna.id)} className="w-full text-center text-sm p-2 rounded-md text-gray-600 hover:bg-gray-300 hover:text-gray-800 transition-colors">
                            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Adicionar Contato
                        </button>
                    </div>
                </div>
            ))}
            <AddColumn onCreate={onCreateColumn} />
        </div>
    );
}