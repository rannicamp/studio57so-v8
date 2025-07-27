// components/crm/FunilKanban.js
"use client";

import React, { useMemo, useState } from 'react';
import ContatoCardCRM from './ContatoCardCRM';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

// O componente para adicionar uma nova ETAPA foi movido para dentro deste arquivo para simplificar
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


export default function FunilKanban({ contatos, statusColumns, onStatusChange, onCreateColumn, onAddContact, onEditColumn, onDeleteColumn, onReorderColumns }) { 
    
    const [editingColumnId, setEditingColumnId] = useState(null);
    const [editedColumnName, setEditedColumnName] = useState("");

    const handleDragStart = (e, contatoNoFunilId) => {
        e.dataTransfer.setData("contatoNoFunilId", contatoNoFunilId);
        // Não adicione e.stopPropagation() aqui, pois o ContatoCardCRM já o faz.
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, colunaDestinoId) => {
        e.preventDefault();
        const contatoNoFunilId = e.dataTransfer.getData("contatoNoFunilId");
        if (contatoNoFunilId) {
            console.log(`FunilKanban: Drag-and-Drop - Dropping card ${contatoNoFunilId} into column ${colunaDestinoId}`); // LOG DE DEBUG
            onStatusChange(contatoNoFunilId, colunaDestinoId);
        }
    };

    // Funções de Drag-and-Drop para COLUNAS
    const handleDragStartColumn = (e, columnId) => {
        e.dataTransfer.setData("draggedColumnId", columnId);
    };

    const handleDropColumn = (e, targetColumnId) => {
        e.preventDefault();
        const draggedColumnId = e.dataTransfer.getData("draggedColumnId");
        if (!draggedColumnId || draggedColumnId === targetColumnId) return;

        // Encontra o índice da coluna arrastada e da coluna de destino
        const draggedIndex = statusColumns.findIndex(col => col.id === draggedColumnId);
        const targetIndex = statusColumns.findIndex(col => col.id === targetColumnId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Cria uma cópia das colunas para não modificar o estado diretamente
        const newColumns = Array.from(statusColumns);
        const [draggedColumn] = newColumns.splice(draggedIndex, 1);
        newColumns.splice(targetIndex, 0, draggedColumn);

        // Atribui novas ordens baseadas na nova posição no array
        const reorderedWithNewOrder = newColumns.map((col, index) => ({
            ...col,
            ordem: index // Define a nova ordem sequencial
        }));
        
        onReorderColumns(reorderedWithNewOrder);
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
        if (window.confirm(`Tem certeza que deseja deletar a etapa "${columnName}"? Todos os contatos nela serão perdidos desta etapa.`)) {
            onDeleteColumn(columnId);
        }
    };

    // Nova função para mover o card de contato através do dropdown
    const handleMoveCardFromDropdown = (contatoNoFunilId, newColumnId) => {
        console.log(`FunilKanban: handleMoveCardFromDropdown - Mover contato ${contatoNoFunilId} para coluna ${newColumnId}`); // LOG DE DEBUG
        onStatusChange(contatoNoFunilId, newColumnId);
    };

    const contatosPorColuna = useMemo(() => {
        const grouped = {};
        if (statusColumns && contatos) {
            statusColumns.forEach(coluna => {
                // Filtra e ordena os contatos pelo numero_card para exibição
                grouped[coluna.id] = contatos
                    .filter(c => c.coluna_id === coluna.id)
                    .sort((a, b) => (a.numero_card || 0) - (b.numero_card || 0)); // Ordena por numero_card
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
                    // Permite arrastar a coluna
                    draggable 
                    onDragStart={(e) => handleDragStartColumn(e, coluna.id)} 
                    // Permite soltar colunas no corpo principal da coluna
                    onDragOver={(e) => e.preventDefault()} 
                    onDrop={(e) => handleDropColumn(e, coluna.id)}
                >
                    <div
                        className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center"
                        // Permite soltar colunas no cabeçalho
                        onDragOver={(e) => e.preventDefault()} 
                        onDrop={(e) => handleDropColumn(e, coluna.id)} 
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
                    <div 
                        className="p-2 space-y-3 overflow-y-auto flex-1"
                        onDragOver={handleDragOver} // Adicionado onDragOver para a área de cards
                        onDrop={(e) => handleDrop(e, coluna.id)} // Adicionado onDrop para a área de cards
                    >
                        {(contatosPorColuna[coluna.id] || []).map((contato) => (
                            <ContatoCardCRM
                                key={contato.id}
                                contato={contato.contatos} // Passa o objeto contato (contatos:contato_id (*))
                                onDragStart={(e) => handleDragStart(e, contato.id)} // Passa o ID da linha contatos_no_funil
                                cardNumber={contato.numero_card}
                                allColumns={statusColumns}
                                onMoveToColumn={handleMoveCardFromDropdown}
                            />
                        ))}
                    </div>
                    <div className="p-2 border-t mt-auto">
                        <button 
                            onClick={() => onAddContact(coluna.id)}
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
