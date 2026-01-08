"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faWallet, faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function FinanceiroStats({ data = {}, isLoading }) {
    // Se estiver carregando, mostra o esqueleto
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 animate-pulse">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>)}
            </div>
        );
    }

    // Extrai os valores diretamente do objeto que veio do banco (via page.js)
    // Usamos '0' como fallback para segurança
    const {
        totalReceitas = 0,
        totalDespesas = 0,
        resultado = 0,
        totalPendente = 0,
        totalPago = 0
    } = data;

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card Receitas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 transition-all hover:shadow-md group">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Receitas</p>
                        <h3 className="text-2xl font-bold text-green-600">{formatMoney(totalReceitas)}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full text-green-600 group-hover:bg-green-200 transition-colors">
                        <FontAwesomeIcon icon={faArrowUp} />
                    </div>
                </div>
                {/* Opcional: Se quiser mostrar detalhes extras aqui, pode adicionar depois */}
            </div>

            {/* Card Despesas */}
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 transition-all hover:shadow-md group">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Despesas</p>
                        <h3 className="text-2xl font-bold text-red-600">{formatMoney(totalDespesas)}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-full text-red-600 group-hover:bg-red-200 transition-colors">
                        <FontAwesomeIcon icon={faArrowDown} />
                    </div>
                </div>
            </div>

            {/* Card Saldo (Receitas - Despesas) */}
            <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${resultado >= 0 ? 'border-blue-500' : 'border-red-500'} transition-all hover:shadow-md group`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo do Período</p>
                        <h3 className={`text-2xl font-bold ${resultado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatMoney(resultado)}
                        </h3>
                    </div>
                    <div className={`p-2 rounded-full ${resultado >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'} group-hover:opacity-80 transition-opacity`}>
                        <FontAwesomeIcon icon={faWallet} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">Receitas - Despesas (Filtro Atual)</p>
            </div>

            {/* Card Caixa Realizado (O que foi efetivamente Pago/Recebido) */}
            <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${totalPago >= 0 ? 'border-gray-600' : 'border-orange-500'} transition-all hover:shadow-md group`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Realizado (Caixa)</p>
                        <h3 className={`text-2xl font-bold ${totalPago >= 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                            {formatMoney(totalPago)}
                        </h3>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-full text-gray-600 group-hover:bg-gray-200 transition-colors">
                        <FontAwesomeIcon icon={faExclamationCircle} />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">Entradas - Saídas (Efetivadas)</p>
            </div>
        </div>
    );
}