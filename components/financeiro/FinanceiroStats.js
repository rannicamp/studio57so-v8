"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faWallet, faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useFinanceiroStats } from '@/hooks/financeiro/useFinanceiroStats';

export default function FinanceiroStats({ filters }) {
    // Agora 'data' é um array contendo UM objeto com os totais, ou o próprio objeto
    const { data, isLoading } = useFinanceiroStats({ filters });

    const stats = useMemo(() => {
        // Pega o objeto de dados (seja array ou objeto direto)
        const dados = Array.isArray(data) ? data[0] : data;

        if (!dados) return {
            receitaTotal: 0,
            receitaRecebida: 0, // A função SQL nova não separa "Recebido" de "Total" explicitamente nos campos antigos, mas retorna totalPago
            despesaTotal: 0,
            despesaPaga: 0,
            saldoGeral: 0,
            saldoRealizado: 0
        };

        // Mapeando os campos do 'get_financeiro_consolidado' para o visual
        // O RPC retorna: totalReceitas, totalDespesas, resultado, totalPago, totalPendente
        
        // NOTA: Para ter "Receita Recebida" e "Despesa Paga" separados, 
        // precisaríamos que o RPC retornasse isso detalhado.
        // O RPC atual retorna 'totalPago' que é o SALDO pago (Receita Paga - Despesa Paga).
        
        // Se precisarmos de precisão absoluta nos cards separados, o ideal é atualizar o RPC
        // mas vamos usar o que temos para manter a consistência com o relatório.
        
        return {
            receitaTotal: Number(dados.totalReceitas || 0),
            // Assumindo que no dashboard queremos ver o Total Previsto vs Realizado
            // Se o RPC não der o detalhe, usamos o total por enquanto
            receitaRecebida: 0, // Ajuste futuro no RPC se necessário
            despesaTotal: Number(dados.totalDespesas || 0),
            despesaPaga: 0, // Ajuste futuro
            saldoGeral: Number(dados.resultado || 0), // (Receitas - Despesas totais)
            saldoRealizado: Number(dados.totalPago || 0) // (Receitas Pagas - Despesas Pagas)
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

            {/* Saldo Previsto */}
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

            {/* Saldo Realizado */}
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