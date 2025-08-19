// components/crm/FunilKanban.js
"use client";

import React, { useMemo, useState } from 'react';
import ContatoCardCRM from './ContatoCardCRM';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

// Componente AddColumn (sem alterações)
const AddColumn = ({ onCreate }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!newColumnName.trim()) return;
        setIsSaving(true);
        await onCreate(newColumnName);
        setIsSaving(false);
        setNewColumnName("");
        setIsCreating(false);
    };

    return (
        <div className="w-80 flex-shrink-0">
            {isCreating ? (
                <div className="p-3 bg-gray-200 rounded-lg">
                    <input
                        type="text"
                        placeholder="Nome da nova etapa"
                        className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button className="px-3 py-1 rounded text-sm" onClick={() => setIsCreating(false)} disabled={isSaving}>Cancelar</button>
                        <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="w-full h-16 flex items-center justify-center gap-2 text-gray-600 font-medium bg-white/30 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors hover:bg-white/70 hover:text-gray-800"
                    onClick={() => setIsCreating(true)}
                >
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
    onAssociateProduct 
}) { 
    
    const [editingColumnId, setEditingColumnId] = useState(null);
    const [editedColumnName, setEditedColumnName] = useState("");
    const [draggedItem, setDraggedItem] = useState(null); // Estado para saber o que está sendo arrastado

    const handleDragStart = (e, item, type) => {
        e.stopPropagation();
        setDraggedItem({ item, type });
        if (type === 'card') {
            e.dataTransfer.setData("contatoNoFunilId", item.id);
        } else if (type === 'column') {
            e.dataTransfer.setData("draggedColumnId", item.id);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // --- LÓGICA DE SOLTAR (DROP) CORRIGIDA E CENTRALIZADA ---
    const handleDrop = (e, targetColumn) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedItem) return;

        // Caso 1: Reordenando uma coluna
        if (draggedItem.type === 'column' && draggedItem.item.id !== targetColumn.id) {
            const draggedColumnId = draggedItem.item.id;
            const targetColumnId = targetColumn.id;

            const draggedIndex = statusColumns.findIndex(col => col.id === draggedColumnId);
            const targetIndex = statusColumns.findIndex(col => col.id === targetColumnId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            const newColumns = Array.from(statusColumns);
            const [draggedColumn] = newColumns.splice(draggedIndex, 1);
            newColumns.splice(targetIndex, 0, draggedColumn);

            const reorderedWithNewOrder = newColumns.map((col, index) => ({ ...col, ordem: index }));
            onReorderColumns(reorderedWithNewOrder);
        }
        
        // Caso 2: Movendo um card para uma nova coluna
        if (draggedItem.type === 'card' && draggedItem.item.coluna_id !== targetColumn.id) {
            onStatusChange(draggedItem.item.id, targetColumn.id);
        }

        setDraggedItem(null); // Limpa o item arrastado
    };

    const handleEditClick = (coluna) => {
        setEditingColumnId(coluna.id);
        setEditedColumnName(coluna.nome);
    };

    const handleSaveEdit = async (columnId) => {
        if (!editedColumnName.trim()) return;
        await onEditColumn(columnId, editedColumnName);
        setEditingColumnId(null);
        setEditedColumnName("");
    };

    const handleCancelEdit = () => {
        setEditingColumnId(null);
        setEditedColumnName("");
    };

    const handleDeleteClick = (columnId, columnName) => {
        if (window.confirm(`Tem certeza que deseja deletar a etapa "${columnName}"? Todos os contatos nela serão movidos para a primeira etapa.`)) {
            onDeleteColumn(columnId);
        }
    };

    const handleMoveCardFromDropdown = (contatoNoFunilId, newColumnId) => {
        onStatusChange(contatoNoFunilId, newColumnId);
    };

    const contatosPorColuna = useMemo(() => {
        const grouped = {};
        if (statusColumns && contatos) {
            statusColumns.forEach(coluna => {
                grouped[coluna.id] = contatos
                    .filter(c => c.coluna_id === coluna.id)
                    .sort((a, b) => (a.numero_card || 0) - (b.numero_card || 0));
            });
        }
        return grouped;
    }, [contatos, statusColumns]);

    return (
        <div className="flex gap-4 overflow-x-auto p-4 h-full bg-gray-100">
            {statusColumns.map((coluna) => (
                <div
                    key={coluna.id}
                    className="w-80 flex-shrink-0 bg-gray-200 rounded-lg shadow-sm flex flex-col"
                    onDragOver={handleDragOver} 
                    onDrop={(e) => handleDrop(e, coluna)}
                >
                    <div
                        className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center cursor-move"
                        draggable 
                        onDragStart={(e) => handleDragStart(e, coluna, 'column')} 
                        onDragEnd={() => setDraggedItem(null)}
                    >
                        {editingColumnId === coluna.id ? (
                            <div className="flex w-full items-center gap-2">
                                <input
                                    type="text"
                                    value={editedColumnName}
                                    onChange={(e) => setEditedColumnName(e.target.value)}
                                    className="flex-grow p-1 border rounded text-sm"
                                    autoFocus
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(coluna.id);
                                    }}
                                />
                                <button onClick={() => handleSaveEdit(coluna.id)} className="text-blue-600 hover:text-blue-800">Salvar</button>
                                <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-800">Cancelar</button>
                            </div>
                        ) : (
                            <>
                                <h3 className="flex-grow">{coluna.nome} ({contatosPorColuna[coluna.id]?.length || 0})</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditClick(coluna)} className="text-gray-500 hover:text-blue-600 transition-colors">
                                        <FontAwesomeIcon icon={faEdit} size="sm" />
                                    </button>
                                    <button onClick={() => handleDeleteClick(coluna.id, coluna.nome)} className="text-gray-500 hover:text-red-600 transition-colors">
                                        <FontAwesomeIcon icon={faTrash} size="sm" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-2 space-y-3 overflow-y-auto flex-1">
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
                            />
                        ))}
                    </div>
                    <div className="p-2 border-t mt-auto">
                        <button 
                            onClick={() => onAddContact()}
                            className="w-full text-center text-sm p-2 rounded-md text-gray-600 hover:bg-gray-300 hover:text-gray-800 transition-colors"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2"/> Adicionar Contato
                        </button>
                    </div>
                </div>
            ))}
            
            <AddColumn onCreate={onCreateColumn} />
        </div>
    );
}