// components/financeiro/FinanceiroStats.js
"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faWallet, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

export default function FinanceiroStats({ data, isLoading }) {
    
    const stats = useMemo(() => {
        // ESTRATÉGIA DE BUSCA DE DADOS:
        
        // 1. Prioridade: O Hook retornou um objeto que contem a propriedade 'stats'?
        // (É assim que o useLancamentos atual funciona)
        if (data && data.stats) {
            return {
                receitaTotal: Number(data.stats.totalReceitas || 0),
                despesaTotal: Number(data.stats.totalDespesas || 0),
                saldoGeral: Number(data.stats.resultado || 0),
                saldoRealizado: Number(data.stats.totalPago || 0)
            };
        }

        // 2. Fallback: O dado veio direto ou dentro de um array (Legado)
        // Se não achar .stats, tenta ler da raiz
        const source = (Array.isArray(data) ? data[0] : data) || {};

        return {
            receitaTotal: Number(source.totalReceitas || 0),
            despesaTotal: Number(source.totalDespesas || 0),
            saldoGeral: Number(source.resultado || 0), // (Receita - Despesa)
            saldoRealizado: Number(source.totalPago || 0) // Caixa Realizado
        };
    }, [data]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 animate-pulse">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>)}
            </div>
        );
    }

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Receitas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Receitas Totais</p>
                        <h3 className="text-2xl font-bold text-green-600">{formatMoney(stats.receitaTotal)}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full text-green-600">
                        <FontAwesomeIcon icon={faArrowUp} />
                    </div>
                </div>
            </div>

            {/* Despesas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Despesas Totais</p>
                        <h3 className="text-2xl font-bold text-red-600">{formatMoney(stats.despesaTotal)}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-full text-red-600">
                        <FontAwesomeIcon icon={faArrowDown} />
                    </div>
                </div>
            </div>

            {/* Saldo Previsto (Resultado) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resultado (Competência)</p>
                        <h3 className={`text-2xl font-bold ${stats.saldoGeral >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatMoney(stats.saldoGeral)}
                        </h3>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                        <FontAwesomeIcon icon={faWallet} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400 border-t pt-2 border-gray-100">Previsto (Tudo)</p>
            </div>

            {/* Saldo Realizado (Caixa) */}
            <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow ${stats.saldoRealizado >= 0 ? 'border-gray-600' : 'border-orange-500'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Caixa (Realizado)</p>
                        <h3 className={`text-2xl font-bold ${stats.saldoRealizado >= 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                            {formatMoney(stats.saldoRealizado)}
                        </h3>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-full text-gray-600">
                        <FontAwesomeIcon icon={faExclamationCircle} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400 border-t pt-2 border-gray-100">Efetivamente Pago</p>
            </div>
        </div>
    );
}