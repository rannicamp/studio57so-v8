// components/crm/FunilManager.js

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPlus, faGripVertical } from '@fortawesome/free-solid-svg-icons';
// Usando a biblioteca correta que já existe no projeto
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Componentes Internos para o Kanban (Adaptados para dnd-kit) ---

const ContatoCard = ({ contato }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contato.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        boxShadow: isDragging ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' : 'none',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="bg-white p-2 rounded-md shadow-sm border border-gray-200 mb-2 touch-none">
            <div className="flex items-center gap-2">
                <button {...listeners} className="cursor-grab p-2 text-gray-400 hover:text-gray-600">
                    <FontAwesomeIcon icon={faGripVertical} />
                </button>
                <FontAwesomeIcon icon={faUserCircle} className="h-8 w-8 text-gray-400" />
                <div>
                    <p className="text-sm font-semibold text-gray-800">{contato.nome || contato.razao_social}</p>
                    <p className="text-xs text-gray-500">{contato.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                </div>
            </div>
        </div>
    );
};

const FunilColuna = ({ coluna }) => {
    const { setNodeRef } = useSortable({ id: coluna.id });
    
    return (
        <div ref={setNodeRef} className="w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm flex flex-col">
            <div className="p-3 text-sm font-semibold text-gray-700 border-b">
                <h3>{coluna.nome} ({coluna.contatos?.length || 0})</h3>
            </div>
            <div className="p-2 min-h-[100px] flex-1">
                <SortableContext items={coluna.contatos.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {coluna.contatos.map(contato => (
                        <ContatoCard key={contato.id} contato={contato} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

// --- Componente Principal ---

export default function FunilManager() {
    const { selectedEmpreendimento } = useEmpreendimento();
    const [funilData, setFunilData] = useState({ funilId: null, colunas: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchFunilData = useCallback(async () => {
        if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
            setFunilData({ funilId: null, colunas: [] });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/crm?empreendimentoId=${selectedEmpreendimento}`);
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Falha ao buscar os dados do funil.');
            
            const colunasComContatos = data.colunas.map(col => ({ ...col, contatos: col.contatos || [] }));
            setFunilData({ ...data, colunas: colunasComContatos });

        } catch (err) {
            console.error("Erro no fetchFunilData:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedEmpreendimento]);

    useEffect(() => { fetchFunilData(); }, [fetchFunilData]);

    const handleOnDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;

        setFunilData(previousData => {
            const oldColunaIndex = previousData.colunas.findIndex(col => col.contatos.some(c => c.id === active.id));
            const newColunaIndex = previousData.colunas.findIndex(col => col.id === over.id || col.contatos.some(c => c.id === over.id));

            if (oldColunaIndex === -1 || newColunaIndex === -1) return previousData;

            // Encontra o ID da coluna de destino real (seja a coluna ou o card sobreposto)
            const novaColunaId = previousData.colunas[newColunaIndex].id;

            // Atualiza a API no backend
            fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contatoId: active.id, novaColunaId: novaColunaId })
            }).catch(() => {
                setError('Falha ao salvar a mudança. Por favor, atualize a página.');
            });

            // Atualização visual otimista
            let itemMovido;
            const novasColunas = previousData.colunas.map(col => {
                const index = col.contatos.findIndex(c => c.id === active.id);
                if (index > -1) {
                    itemMovido = col.contatos[index];
                    return { ...col, contatos: col.contatos.filter(c => c.id !== active.id) };
                }
                return col;
            });

            const colunaDestino = novasColunas.find(c => c.id === novaColunaId);
            if(colunaDestino && itemMovido) {
                // Encontra a posição correta para inserir
                const overIndex = colunaDestino.contatos.findIndex(c => c.id === over.id);
                if (overIndex > -1) {
                    colunaDestino.contatos.splice(overIndex, 0, itemMovido);
                } else {
                     colunaDestino.contatos.push(itemMovido);
                }
            }
            return { ...previousData, colunas: novasColunas };
        });
    };

    const handleAddColuna = async () => {
        const nomeNovaColuna = prompt("Digite o nome da nova coluna (Ex: Qualificação):");
        if (!nomeNovaColuna || !funilData.funilId) return;
        try {
            await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ funilId: funilData.funilId, nomeColuna: nomeNovaColuna })
            });
            fetchFunilData();
        } catch (err) {
            setError('Erro ao criar coluna: ' + err.message);
        }
    };
    
    if (loading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>;
    if (!selectedEmpreendimento || selectedEmpreendimento === 'all') return <div className="text-center p-10 text-gray-500 font-semibold">Selecione um empreendimento no cabeçalho para ver o funil de vendas.</div>;
    if (error) return <div className="text-center p-10 text-red-500 bg-red-50 border border-red-200 rounded-md"><b>Erro:</b> {error}</div>;

    return (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleOnDragEnd}>
            <div className="flex gap-4 overflow-x-auto p-4 h-full">
                <SortableContext items={funilData.colunas.map(c => c.id)}>
                    {funilData.colunas.map(coluna => (
                        <FunilColuna key={coluna.id} coluna={coluna} />
                    ))}
                </SortableContext>
                <div className="w-80 flex-shrink-0">
                    <button onClick={handleAddColuna} disabled={!funilData.funilId} className="w-full bg-gray-200 text-gray-600 p-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <FontAwesomeIcon icon={faPlus} /> Adicionar Nova Coluna
                    </button>
                </div>
            </div>
        </DndContext>
    );
}