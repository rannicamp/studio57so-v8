"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faWallet, faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useFinanceiroStats } from '@/hooks/financeiro/useFinanceiroStats'; // <--- Importando o cérebro

export default function FinanceiroStats({ filters }) {
    // Agora o componente busca seus próprios dados direto do banco!
    const { data = [], isLoading } = useFinanceiroStats({ filters });

    // Processamento dos dados agregados vindos do RPC do Supabase
    // O RPC deve retornar linhas agrupadas (ex: Receita/Pago/Total), e aqui nós somamos esses grupos.
    const stats = useMemo(() => {
        let receitaTotal = 0;
        let receitaRecebida = 0;
        let despesaTotal = 0;
        let despesaPaga = 0;

        // O 'data' aqui não são mais milhares de linhas, são apenas as somas agrupadas pelo banco.
        // Isso deixa o front-end super leve.
        data.forEach(item => {
            const valor = Number(item.valor_total) || 0;
            
            if (item.tipo_lancamento === 'Receita') {
                receitaTotal += valor;
                if (item.status_lancamento === 'Pago' || item.status_lancamento === 'Conciliado') {
                    receitaRecebida += valor;
                }
            } else if (item.tipo_lancamento === 'Despesa') {
                despesaTotal += valor;
                if (item.status_lancamento === 'Pago' || item.status_lancamento === 'Conciliado') {
                    despesaPaga += valor;
                }
            }
        });

        return {
            receitaTotal,
            receitaRecebida,
            receitaPendente: receitaTotal - receitaRecebida,
            despesaTotal,
            despesaPaga,
            despesaPendente: despesaTotal - despesaPaga,
            saldoGeral: receitaTotal - despesaTotal,
            saldoRealizado: receitaRecebida - despesaPaga
        };
    }, [data]);

    if (isLoading && data.length === 0) {
        return <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>)}
        </div>;
    }

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card Receitas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Receitas</p>
                        <h3 className="text-2xl font-bold text-green-600">{formatMoney(stats.receitaTotal)}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full text-green-600 group-hover:bg-green-200 transition-colors">
                        <FontAwesomeIcon icon={faArrowUp} />
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex justify-between border-t pt-2 border-gray-100">
                    <span>Recebido:</span>
                    <span className="font-semibold text-green-700">{formatMoney(stats.receitaRecebida)}</span>
                </div>
            </div>

            {/* Card Despesas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Despesas</p>
                        <h3 className="text-2xl font-bold text-red-600">{formatMoney(stats.despesaTotal)}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-full text-red-600 group-hover:bg-red-200 transition-colors">
                        <FontAwesomeIcon icon={faArrowDown} />
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex justify-between border-t pt-2 border-gray-100">
                    <span>Pago:</span>
                    <span className="font-semibold text-red-700">{formatMoney(stats.despesaPaga)}</span>
                </div>
            </div>

            {/* Card Saldo Previsto (Competência) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
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
                <p className="mt-2 text-xs text-gray-400 border-t pt-2 border-gray-100">Receitas - Despesas (Todas)</p>
            </div>

            {/* Card Saldo Real (Caixa) */}
            <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow ${stats.saldoRealizado >= 0 ? 'border-gray-600' : 'border-orange-500'}`}>
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
                <p className="mt-2 text-xs text-gray-400 border-t pt-2 border-gray-100">Efetivamente Pago/Recebido</p>
            </div>
        </div>
    );
}