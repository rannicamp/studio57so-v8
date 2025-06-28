"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import OrcamentoDetalhes from './OrcamentoDetalhes'; // Importando o novo componente

export default function OrcamentoManager({ empreendimentos }) {
    const supabase = createClient();
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [orcamentos, setOrcamentos] = useState([]);
    const [selectedOrcamento, setSelectedOrcamento] = useState(null); // Novo estado para controlar o orçamento selecionado
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const fetchOrcamentos = useCallback(async (empreendimentoId) => {
        if (!empreendimentoId) {
            setOrcamentos([]);
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            const { data, error } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('empreendimento_id', empreendimentoId)
                .order('versao', { ascending: false });

            if (error) throw error;
            setOrcamentos(data || []);
        } catch (error) {
            setMessage(`Erro ao buscar orçamentos: ${error.message}`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const handleEmpreendimentoChange = (e) => {
        const newId = e.target.value;
        setSelectedEmpreendimentoId(newId);
        setSelectedOrcamento(null); // Limpa o orçamento selecionado ao trocar de empreendimento
        fetchOrcamentos(newId);
    };

    const handleCreateNewOrcamento = async () => {
        if (!selectedEmpreendimentoId) {
            setMessage('Por favor, selecione um empreendimento primeiro.');
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('orcamentos')
            .insert({
                empreendimento_id: selectedEmpreendimentoId,
                nome_orcamento: `Orçamento Padrão - Versão 1`,
                versao: 1
            })
            .select()
            .single(); // Espera um único objeto

        if (error) {
            setMessage(`Erro ao criar orçamento: ${error.message}`);
        } else {
            setMessage('Novo orçamento criado com sucesso!');
            setOrcamentos(prev => [...prev, data]);
            setSelectedOrcamento(data); // Seleciona o orçamento recém-criado
        }
        setLoading(false);
    };

    // Se um orçamento estiver selecionado, mostra a tela de detalhes
    if (selectedOrcamento) {
        return <OrcamentoDetalhes orcamento={selectedOrcamento} onBack={() => setSelectedOrcamento(null)} />;
    }

    // Tela principal para selecionar empreendimento e orçamento
    return (
        <div className="space-y-4">
            <div className="flex items-end gap-4">
                <div className="flex-grow">
                    <label htmlFor="empreendimento-select" className="block text-sm font-medium text-gray-700">
                        Selecione um Empreendimento
                    </label>
                    <select
                        id="empreendimento-select"
                        value={selectedEmpreendimentoId}
                        onChange={handleEmpreendimentoChange}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                    >
                        <option value="">-- Selecione --</option>
                        {empreendimentos.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div className="text-center py-4">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-gray-500" />
                    <p className="text-sm">Buscando orçamentos...</p>
                </div>
            )}

            {message && <p className="text-center font-medium text-sm p-2 bg-green-50 text-green-700 rounded-md">{message}</p>}

            {selectedEmpreendimentoId && !loading && (
                <div className="mt-6 border-t pt-6">
                    {orcamentos.length > 0 ? (
                        <div>
                            <h3 className="text-lg font-semibold">Orçamentos para este Empreendimento:</h3>
                            <ul className="mt-2 divide-y">
                                {orcamentos.map(orc => (
                                    <li key={orc.id} className="py-3">
                                        <button onClick={() => setSelectedOrcamento(orc)} className="text-blue-600 hover:underline font-medium">
                                            {orc.nome_orcamento} (Versão {orc.versao})
                                        </button>
                                        <p className="text-sm text-gray-500">Criado em: {new Date(orc.created_at).toLocaleDateString('pt-BR')}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-lg">
                            <p className="text-gray-500">Nenhum orçamento encontrado para este empreendimento.</p>
                            <button
                                onClick={handleCreateNewOrcamento}
                                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600"
                            >
                                + Criar Primeiro Orçamento
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}