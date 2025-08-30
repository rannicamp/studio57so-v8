// components/contratos/ParcelasPagas.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt } from '@fortawesome/free-solid-svg-icons';

// Funções de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

export default function ParcelasPagas({ contatoId }) {
    const [lancamentosPagos, setLancamentosPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchLancamentosPagos = async () => {
            if (!contatoId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const { data, error } = await supabase
                .from('lancamentos')
                .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
                .eq('favorecido_contato_id', contatoId)
                .eq('status', 'Pago')
                .order('data_pagamento', { ascending: false });

            if (error) {
                console.error("Erro ao buscar lançamentos pagos:", error);
                setLancamentosPagos([]);
            } else {
                setLancamentosPagos(data || []);
            }
            setLoading(false);
        };

        fetchLancamentosPagos();
    }, [contatoId, supabase]);

    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando histórico de pagamentos...</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faReceipt} /> Histórico de Pagamentos
            </h3>
            
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Data do Pagamento</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Descrição</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Categoria</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700 uppercase">Valor Pago</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {lancamentosPagos.length > 0 ? (
                            lancamentosPagos.map(lancamento => (
                                <tr key={lancamento.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(lancamento.data_pagamento)}</td>
                                    <td className="px-4 py-3">{lancamento.descricao}</td>
                                    <td className="px-4 py-3">{lancamento.categoria?.nome || 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(lancamento.valor)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-500">
                                    Nenhum pagamento registrado para este cliente.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}