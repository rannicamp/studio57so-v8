"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, 
    faMoneyBillWave, 
    faSort, 
    faSortUp, 
    faSortDown,
    faPenToSquare
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Utilitários
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatSimpleDate = (dateString) => {
    if (!dateString) return '-';
    // Garante tratamento correto de string YYYY-MM-DD
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

export default function ContratoFinanceiro({ contrato }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [lancamentos, setLancamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Configuração de Ordenação (Padrão Ficha Funcionário)
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });

    // --- 1. BUSCA DE DADOS ---
    useEffect(() => {
        if (contrato?.fornecedor_id && user?.organizacao_id) {
            fetchFinanceiro();
        }
    }, [contrato, user?.organizacao_id]);

    const fetchFinanceiro = async () => {
        setLoading(true);
        try {
            // Buscamos TODOS os lançamentos onde o favorecido é este fornecedor
            const { data, error } = await supabase
                .from('lancamentos')
                .select(`
                    id, 
                    descricao, 
                    valor, 
                    data_vencimento, 
                    data_pagamento,
                    data_transacao,
                    status, 
                    tipo,
                    categoria:categoria_id(nome)
                `)
                .eq('organizacao_id', user.organizacao_id)
                .eq('favorecido_contato_id', contrato.fornecedor_id) 
                .order('data_vencimento', { ascending: false });
            
            if (error) throw error;
            setLancamentos(data || []);
        } catch (error) {
            console.error("Erro ao buscar financeiro:", error);
            toast.error("Erro ao carregar lançamentos.");
        } finally {
            setLoading(false);
        }
    };

    // --- 2. LÓGICA DE ORDENAÇÃO ---
    const sortedLancamentos = useMemo(() => {
        let sortableItems = [...lancamentos].map(lanc => ({
            ...lanc,
            // Lógica inteligente: Se tá pago/conciliado usa a data de pagamento, senão vencimento
            data_ordenacao: ['Pago', 'Conciliado'].includes(lanc.status) 
                ? lanc.data_pagamento 
                : (lanc.data_vencimento || lanc.data_transacao)
        }));

        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let valA, valB;
                
                // Tratamento específico por tipo de coluna
                if (['data_vencimento', 'data_pagamento'].includes(sortConfig.key)) {
                    valA = new Date(a.data_ordenacao || 0);
                    valB = new Date(b.data_ordenacao || 0);
                } else if (sortConfig.key === 'categoria.nome') {
                    valA = a.categoria?.nome || '';
                    valB = b.categoria?.nome || '';
                } else {
                    valA = a[sortConfig.key] || '';
                    valB = b[sortConfig.key] || '';
                }

                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [lancamentos, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };

    // Componente de Cabeçalho Ordenável
    const SortableHeader = ({ label, sortKey, className = '' }) => (
        <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 hover:text-gray-700">
                {label}
                <FontAwesomeIcon icon={getSortIcon(sortKey)} className="text-gray-400" />
            </button>
        </th>
    );

    // --- 3. CÁLCULOS KPI (Conciliado = Pago) ---
    const totalPago = lancamentos
        .filter(l => ['Pago', 'Conciliado'].includes(l.status))
        .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

    const totalPendente = lancamentos
        .filter(l => !['Pago', 'Conciliado'].includes(l.status))
        .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

    // --- RENDERIZAÇÃO ---
    if (loading) return <div className="p-10 text-center text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            
            {/* KPIs - Resumo Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <span className="text-green-600 text-xs font-bold uppercase">Total Pago / Conciliado</span>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                        {formatCurrency(totalPago)}
                    </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                    <span className="text-yellow-600 text-xs font-bold uppercase">A Pagar / Pendente</span>
                    <div className="text-2xl font-bold text-yellow-700 mt-1">
                        {formatCurrency(totalPendente)}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <span className="text-gray-500 text-xs font-bold uppercase">Total Geral</span>
                    <div className="text-2xl font-bold text-gray-700 mt-1">
                        {formatCurrency(totalPago + totalPendente)}
                    </div>
                </div>
            </div>

            {/* TABELA (IGUAL FICHA FUNCIONÁRIO) */}
            {lancamentos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-gray-300 text-4xl mb-3" />
                    <p className="text-gray-500 font-medium">Nenhum lançamento financeiro encontrado.</p>
                    <p className="text-sm text-gray-400 mt-1">Verifique se o fornecedor está vinculado corretamente no lançamento.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <SortableHeader label="Data" sortKey="data_vencimento" />
                                <SortableHeader label="Descrição" sortKey="descricao" />
                                <SortableHeader label="Categoria" sortKey="categoria.nome" />
                                <SortableHeader label="Valor" sortKey="valor" />
                                <th className="px-4 py-2 text-center text-xs font-bold uppercase">Status</th>
                                {/* <th className="px-4 py-2 text-center text-xs font-bold uppercase">Ações</th> */}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedLancamentos.map(lanc => {
                                const dataExibida = ['Pago', 'Conciliado'].includes(lanc.status) 
                                    ? lanc.data_pagamento 
                                    : (lanc.data_vencimento || lanc.data_transacao);
                                
                                const isReceita = lanc.tipo === 'Receita';
                                const isPago = ['Pago', 'Conciliado'].includes(lanc.status);

                                return (
                                    <tr key={lanc.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                            {formatSimpleDate(dataExibida)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                            {lanc.descricao}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-500">
                                            {lanc.categoria?.nome || 'N/A'}
                                        </td>
                                        <td className={`px-4 py-2 text-right font-semibold text-sm ${isReceita ? 'text-green-600' : 'text-gray-800'}`}>
                                            {formatCurrency(lanc.valor)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                isPago ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {lanc.status === 'Conciliado' ? 'Conciliado' : lanc.status}
                                            </span>
                                        </td>
                                        {/* Ações (Comentado até implementarmos o modal de edição aqui)
                                        <td className="px-4 py-2 text-center">
                                            <button className="text-blue-600 hover:text-blue-800">
                                                <FontAwesomeIcon icon={faPenToSquare} />
                                            </button>
                                        </td>
                                        */}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}