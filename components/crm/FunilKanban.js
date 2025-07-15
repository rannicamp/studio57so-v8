// components/crm/FunilKanban.js
"use client";

// AQUI ESTÁ A CORREÇÃO: Adicionamos o 'useState' na importação
import React, { useMemo, useState } from 'react';
import ContatoCardCRM from './ContatoCardCRM';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

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


export default function FunilKanban({ contatos, statusColumns, onStatusChange, onCreateColumn, onAddContact }) {
    
    const handleDragStart = (e, contatoNoFunilId) => {
        e.dataTransfer.setData("contatoNoFunilId", contatoNoFunilId);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, colunaDestinoId) => {
        e.preventDefault();
        const contatoNoFunilId = e.dataTransfer.getData("contatoNoFunilId");
        if (contatoNoFunilId) {
            onStatusChange(contatoNoFunilId, colunaDestinoId);
        }
    };

    const contatosPorColuna = useMemo(() => {
        const grouped = {};
        if (statusColumns && contatos) {
            statusColumns.forEach(coluna => {
                grouped[coluna.id] = contatos.filter(c => c.coluna_id === coluna.id);
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
                    onDrop={(e) => handleDrop(e, coluna.id)}
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg">
                        <h3>{coluna.nome} ({contatosPorColuna[coluna.id]?.length || 0})</h3>
                    </div>
                    <div className="p-2 space-y-3 overflow-y-auto flex-1">
                        {(contatosPorColuna[coluna.id] || []).map((contato) => (
                            <ContatoCardCRM
                                key={contato.id}
                                contato={contato.contatos}
                                onDragStart={(e) => handleDragStart(e, contato.id)}
                            />
                        ))}
                    </div>
                    {/* --- NOVO: Botão para Adicionar Contato --- */}
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
            
            {/* Componente para adicionar uma nova ETAPA */}
            <AddColumn onCreate={onCreateColumn} />
        </div>
    );
}