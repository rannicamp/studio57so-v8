"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFilter, faCalendarDay, faCalendarWeek, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from './MultiSelectDropdown';

const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export default function ExtratoManager({ contas, onEdit }) {
    const supabase = createClient();
    
    // ***** INÍCIO DA CORREÇÃO 1/3 *****
    // O estado inicial agora tenta carregar os dados salvos no sessionStorage.
    const [filters, setFilters] = useState(() => {
        if (typeof window === 'undefined') {
            return { contaIds: [], startDate: '', endDate: '' };
        }
        const savedState = sessionStorage.getItem('lastExtratoState');
        return savedState ? JSON.parse(savedState).filters : { contaIds: [], startDate: '', endDate: '' };
    });
    const [extratoItens, setExtratoItens] = useState(() => {
        if (typeof window === 'undefined') return [];
        const savedState = sessionStorage.getItem('lastExtratoState');
        return savedState ? JSON.parse(savedState).extratoItens : [];
    });
    const [saldoAnterior, setSaldoAnterior] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const savedState = sessionStorage.getItem('lastExtratoState');
        return savedState ? JSON.parse(savedState).saldoAnterior : 0;
    });
    // ***** FIM DA CORREÇÃO 1/3 *****

    const [loading, setLoading] = useState(false);
    const [activePeriodFilter, setActivePeriodFilter] = useState('month');

    // Define o período inicial para o mês atual, SOMENTE se não houver dados salvos.
    useEffect(() => {
        const savedState = sessionStorage.getItem('lastExtratoState');
        if (!savedState) {
            setDateRange('month');
        }
    }, []);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name !== 'startDate' && name !== 'endDate') {
            setActivePeriodFilter('');
        }
    };
    
    const setDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') {
            startDate = endDate = today;
        } else if (period === 'week') {
            const firstDayOfWeek = today.getDate() - today.getDay();
            startDate = new Date(today.setDate(firstDayOfWeek));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        setFilters(prev => ({
            ...prev,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        }));
        setActivePeriodFilter(period);
    };

    const fetchExtrato = useCallback(async () => {
        if (!filters.contaIds || filters.contaIds.length === 0) {
            setExtratoItens([]);
            // ***** INÍCIO DA CORREÇÃO 2/3 *****
            // Limpa o estado salvo se a busca for inválida
            sessionStorage.removeItem('lastExtratoState');
            // ***** FIM DA CORREÇÃO 2/3 *****
            return;
        }
        setLoading(true);
        setExtratoItens([]);
        setSaldoAnterior(0);

        try {
            const saldoPromises = filters.contaIds.map(contaId => 
                supabase.rpc('calcular_saldo_anterior', { p_conta_id: contaId, p_data_inicio: filters.startDate })
            );
            const saldosResponses = await Promise.all(saldoPromises);

            let saldoInicialTotal = 0;
            saldosResponses.forEach(response => {
                if (response.error) throw response.error;
                saldoInicialTotal += response.data;
            });
            setSaldoAnterior(saldoInicialTotal);

            const { data: lancamentos, error: lancamentosError } = await supabase
                .from('lancamentos')
                .select('*, favorecido:contatos!favorecido_contato_id(*), categoria:categorias_financeiras(*)')
                .in('conta_id', filters.contaIds)
                .gte('data_pagamento', filters.startDate)
                .lte('data_pagamento', filters.endDate)
                .in('status', ['Pago', 'Conciliado'])
                .order('data_pagamento', { ascending: true })
                .order('created_at', { ascending: true });
            
            if (lancamentosError) throw lancamentosError;
            
            let saldoCorrente = saldoInicialTotal;
            const itensProcessados = lancamentos.map(lanc => {
                const entrada = lanc.tipo === 'Receita' ? lanc.valor : 0;
                const saida = lanc.tipo === 'Despesa' ? lanc.valor : 0;
                saldoCorrente += entrada - saida;
                return { 
                    ...lanc,
                    entrada,
                    saida,
                    saldo: saldoCorrente 
                };
            });

            setExtratoItens(itensProcessados);

            // ***** INÍCIO DA CORREÇÃO 3/3 *****
            // Salva o resultado da busca bem-sucedida no sessionStorage
            const stateToSave = {
                filters,
                extratoItens: itensProcessados,
                saldoAnterior: saldoInicialTotal
            };
            sessionStorage.setItem('lastExtratoState', JSON.stringify(stateToSave));
            // ***** FIM DA CORREÇÃO 3/3 *****

        } catch (error) {
            console.error("Erro ao gerar extrato:", error);
            alert(`Erro ao buscar dados do extrato: ${error.message}`);
        } finally {
            setLoading(false);
        }

    }, [filters.contaIds, filters.startDate, filters.endDate, supabase]);

    const saldoFinal = extratoItens.length > 0 ? extratoItens[extratoItens.length - 1].saldo : saldoAnterior;

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <MultiSelectDropdown 
                            label="Conta(s) Financeira(s) *"
                            options={contas}
                            selectedIds={filters.contaIds}
                            onChange={(selected) => handleFilterChange('contaIds', selected)}
                            placeholder="Selecione uma ou mais contas"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="block text-sm font-medium">De:</label>
                            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Até:</label>
                            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 justify-start md:justify-end">
                        <button onClick={() => setDateRange('today')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                        <button onClick={() => setDateRange('week')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                        <button onClick={() => setDateRange('month')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                    </div>
                </div>
                 <div className="text-right pt-4 border-t">
                    <button
                        onClick={fetchExtrato}
                        disabled={loading || !filters.contaIds || filters.contaIds.length === 0}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilter} />}
                        {loading ? 'Gerando...' : 'Gerar Extrato'}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase w-1/12">ID</th>
                            <th className="px-4 py-3 text-left font-bold uppercase w-1/12">Data</th>
                            <th className="px-4 py-3 text-left font-bold uppercase w-4/12">Descrição</th>
                            <th className="px-4 py-3 text-right font-bold uppercase w-2/12">Entrada</th>
                            <th className="px-4 py-3 text-right font-bold uppercase w-2/12">Saída</th>
                            <th className="px-4 py-3 text-right font-bold uppercase w-2/12">Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="bg-gray-50 font-semibold">
                            <td className="px-4 py-2" colSpan="5">SALDO ANTERIOR EM {formatDate(filters.startDate)}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(saldoAnterior)}</td>
                        </tr>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                        ) : extratoItens.length > 0 ? (
                            extratoItens.map((item) => (
                                <tr key={item.id} onClick={() => onEdit(item)} className="cursor-pointer hover:bg-blue-50">
                                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.id}</td>
                                    <td className="px-4 py-2">{formatDate(item.data_pagamento)}</td>
                                    <td className="px-4 py-2">{item.descricao}</td>
                                    <td className="px-4 py-2 text-right text-green-600">
                                        {item.entrada > 0 ? formatCurrency(item.entrada) : ''}
                                    </td>
                                    <td className="px-4 py-2 text-right text-red-600">
                                        {item.saida > 0 ? formatCurrency(item.saida) : ''}
                                    </td>
                                    <td className={`px-4 py-2 text-right font-semibold ${item.saldo < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                        {formatCurrency(item.saldo)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-gray-500">
                                    Nenhum lançamento encontrado para o período e conta selecionados.
                                </td>
                            </tr>
                        )}
                        <tr className="bg-gray-100 font-bold text-base">
                            <td className="px-4 py-3" colSpan="5">SALDO FINAL</td>
                            <td className={`px-4 py-3 text-right ${saldoFinal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {formatCurrency(saldoFinal)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}