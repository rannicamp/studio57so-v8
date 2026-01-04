"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faWallet, faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function FinanceiroStats({ data = {}, isLoading }) {
    // Agora pegamos os dados prontos do objeto 'kpis' que vem do SQL
    // Se não tiver dados, assume 0 para tudo.
    const stats = useMemo(() => {
        const kpis = data?.kpis || {};
        return {
            receitaTotal: Number(kpis.receitaTotal) || 0,
            receitaRecebida: Number(kpis.receitaRealizada) || 0,
            despesaTotal: Number(kpis.despesaTotal) || 0,
            despesaPaga: Number(kpis.despesaRealizada) || 0,
            saldoGeral: Number(kpis.saldoGeral) || 0,
            saldoRealizado: Number(kpis.saldoRealizado) || 0
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
            {/* Card Receitas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Receitas</p>
                        <h3 className="text-2xl font-bold text-green-600">{formatMoney(stats.receitaTotal)}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full text-green-600">
                        <FontAwesomeIcon icon={faArrowUp} />
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span>Recebido: <span className="font-semibold text-green-700">{formatMoney(stats.receitaRecebida)}</span></span>
                </div>
            </div>

            {/* Card Despesas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Despesas</p>
                        <h3 className="text-2xl font-bold text-red-600">{formatMoney(stats.despesaTotal)}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-full text-red-600">
                        <FontAwesomeIcon icon={faArrowDown} />
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span>Pago: <span className="font-semibold text-red-700">{formatMoney(stats.despesaPaga)}</span></span>
                </div>
            </div>

            {/* Card Saldo Previsto (Tudo) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo (Previsto)</p>
                        <h3 className={`text-2xl font-bold ${stats.saldoGeral >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatMoney(stats.saldoGeral)}
                        </h3>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                        <FontAwesomeIcon icon={faWallet} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">Receitas - Despesas (Todas)</p>
            </div>

            {/* Card Saldo Real (Caixa) */}
            <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${stats.saldoRealizado >= 0 ? 'border-gray-600' : 'border-orange-500'} transition-all hover:shadow-md`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo em Caixa (Real)</p>
                        <h3 className={`text-2xl font-bold ${stats.saldoRealizado >= 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                            {formatMoney(stats.saldoRealizado)}
                        </h3>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-full text-gray-600">
                        <FontAwesomeIcon icon={faExclamationCircle} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">Efetivamente Pago/Recebido</p>
            </div>
        </div>
    );
}