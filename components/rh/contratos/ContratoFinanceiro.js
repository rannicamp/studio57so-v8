"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faMoneyBillWave, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function ContratoFinanceiro({ contrato }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [lancamentos, setLancamentos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (contrato?.fornecedor_id && user?.organizacao_id) {
            fetchFinanceiro();
        }
    }, [contrato, user?.organizacao_id]);

    const fetchFinanceiro = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('lancamentos')
                .select(`id, descricao, valor, data_vencimento, status, categoria:categoria_id(nome)`)
                .eq('organizacao_id', user.organizacao_id)
                .eq('contato_id', contrato.fornecedor_id)
                .gte('data_vencimento', contrato.data_inicio);

            if (contrato.data_fim) {
                query = query.lte('data_vencimento', contrato.data_fim);
            }

            const { data } = await query.order('data_vencimento', { ascending: false });
            setLancamentos(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>;

    // Totais
    const totalPago = lancamentos.filter(l => l.status === 'Pago').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const totalPendente = lancamentos.filter(l => l.status !== 'Pago').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const totalGeral = totalPago + totalPendente;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <span className="text-green-600 text-xs font-bold uppercase">Total Pago</span>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPago)}
                    </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                    <span className="text-yellow-600 text-xs font-bold uppercase">A Pagar</span>
                    <div className="text-2xl font-bold text-yellow-700 mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <span className="text-gray-500 text-xs font-bold uppercase">Total Acumulado</span>
                    <div className="text-2xl font-bold text-gray-700 mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}
                    </div>
                </div>
            </div>

            {/* Tabela */}
            {lancamentos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-gray-300 text-4xl mb-3" />
                    <p className="text-gray-500">Nenhum lançamento financeiro encontrado.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3">Vencimento</th>
                                <th className="px-6 py-3">Descrição</th>
                                <th className="px-6 py-3">Categoria</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {lancamentos.map(lanc => (
                                <tr key={lanc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-700">
                                        {new Date(lanc.data_vencimento).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{lanc.descricao}</td>
                                    <td className="px-6 py-4 text-gray-500">{lanc.categoria?.nome || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        {lanc.status === 'Pago' ? (
                                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                <FontAwesomeIcon icon={faCheckCircle} /> Pago
                                            </span>
                                        ) : (
                                            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendente</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lanc.valor)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}