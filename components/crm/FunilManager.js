// components/crm/FunilManager.js

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPlus } from '@fortawesome/free-solid-svg-icons';

// --- Componentes Internos para o Kanban ---

const ContatoCard = ({ contato }) => (
    <div className="bg-white p-3 rounded-md shadow border border-gray-200 cursor-pointer hover:shadow-md">
        <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faUserCircle} className="h-8 w-8 text-gray-400" />
            <div>
                <p className="text-sm font-semibold text-gray-800">{contato.nome || contato.razao_social}</p>
                <p className="text-xs text-gray-500">{contato.telefones?.[0]?.telefone || 'Sem telefone'}</p>
            </div>
        </div>
    </div>
);

const FunilColuna = ({ coluna }) => (
    <div className="w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm flex flex-col">
        <div className="p-3 text-sm font-semibold text-gray-700 border-b">
            <h3>{coluna.nome} ({coluna.contatos?.length || 0})</h3>
        </div>
        <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
            {coluna.contatos?.map(contato => (
                <ContatoCard key={contato.id} contato={contato} />
            ))}
        </div>
    </div>
);

// --- Componente Principal ---

export default function FunilManager() {
    const { selectedEmpreendimento } = useEmpreendimento();
    const [funilData, setFunilData] = useState({ funilId: null, colunas: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchFunilData = useCallback(async () => {
        if (!selectedEmpreendimento) {
            setFunilData({ funilId: null, colunas: [] });
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/crm?empreendimentoId=${selectedEmpreendimento}`);
            if (!response.ok) {
                throw new Error('Falha ao buscar os dados do funil.');
            }
            const data = await response.json();
            setFunilData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedEmpreendimento]);

    useEffect(() => {
        fetchFunilData();
    }, [fetchFunilData]);

    const handleAddColuna = async () => {
        const nomeNovaColuna = prompt("Digite o nome da nova coluna (Ex: Qualificação, Proposta Enviada):");
        if (!nomeNovaColuna || !funilData.funilId) return;

        try {
            const response = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ funilId: funilData.funilId, nomeColuna: nomeNovaColuna })
            });
            if (!response.ok) throw new Error('Falha ao criar a coluna.');
            fetchFunilData(); // Recarrega os dados para mostrar a nova coluna
        } catch (err) {
            setError('Erro ao criar coluna: ' + err.message);
        }
    };

    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">{error}</div>;
    }

    if (!selectedEmpreendimento) {
        return <div className="text-center p-10 text-gray-500">Selecione um empreendimento no cabeçalho para ver o funil.</div>;
    }

    return (
        <div className="flex gap-4 overflow-x-auto p-4 h-full">
            {funilData.colunas.map(coluna => (
                <FunilColuna key={coluna.id} coluna={coluna} />
            ))}
            <div className="w-80 flex-shrink-0">
                <button
                    onClick={handleAddColuna}
                    className="w-full bg-gray-200 text-gray-600 p-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} /> Adicionar Nova Coluna
                </button>
            </div>
        </div>
    );
}