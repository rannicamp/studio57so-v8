"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faExclamationTriangle, faFileInvoiceDollar, 
    faCalendarAlt, faCalculator, faSearch 
} from '@fortawesome/free-solid-svg-icons';

const fetchDetalhesFolha = async (organizacao_id, mesRef) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_previsao_folha_detalhada', {
        p_organizacao_id: organizacao_id,
        p_mes_ref: mesRef
    });
    if (error) throw new Error(error.message);
    return data || [];
};

export default function PlanejamentoFolha() {
    const { user } = useAuth();
    const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7) + '-01');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: folha, isLoading, isError } = useQuery({
        queryKey: ['folhaDetalhada', user?.organizacao_id, mesRef],
        queryFn: () => fetchDetalhesFolha(user?.organizacao_id, mesRef),
        enabled: !!user?.organizacao_id,
        staleTime: 1000 * 60 * 5 // 5 minutos
    });

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    const filteredFolha = folha?.filter(item => 
        item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cargo.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const totalGeral = filteredFolha.reduce((acc, item) => acc + (item.custo_calculado || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header com Filtros e Totais */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        Planejamento de Folha
                    </h2>
                    <p className="text-sm text-gray-500">Auditoria detalhada de custos salariais previstos.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Input de Busca */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar funcionário..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                        />
                    </div>

                    {/* Seletor de Mês */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400" />
                        </div>
                        <input 
                            type="month" 
                            value={mesRef.slice(0, 7)}
                            onChange={(e) => setMesRef(`${e.target.value}-01`)}
                            className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Card de Totalizador */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                        <FontAwesomeIcon icon={faCalculator} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-blue-800">Custo Total Previsto (Filtrado)</p>
                        <p className="text-xs text-blue-600">Baseado nas regras de contratação ativas</p>
                    </div>
                </div>
                <h3 className="text-3xl font-bold text-blue-900">{formatCurrency(totalGeral)}</h3>
            </div>

            {/* Tabela de Detalhes */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                        <p>Calculando folha linha a linha...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center p-12 text-red-500 bg-red-50">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
                        <p>Erro ao carregar dados da folha.</p>
                    </div>
                ) : filteredFolha.length === 0 ? (
                    <div className="text-center p-12 text-gray-500">
                        <p>Nenhum funcionário encontrado para este período.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Funcionário</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Regra</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Salário Base</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Valor Diária</th>
                                    <th className="px-6 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">Dias Ref.</th>
                                    <th className="px-6 py-3 text-right font-bold text-gray-700 uppercase tracking-wider bg-gray-100">Custo Final</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredFolha.map((item) => (
                                    <tr key={item.funcionario_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{item.nome}</div>
                                            <div className="text-xs text-gray-500">{item.cargo}</div>
                                            {item.observacao && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                                    {item.observacao}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.modelo_contratacao === 'Mensalista' ? 'bg-purple-100 text-purple-800' : 'bg-teal-100 text-teal-800'}`}>
                                                {item.modelo_contratacao}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                                            {item.salario_base > 0 ? formatCurrency(item.salario_base) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                                            {item.valor_diaria > 0 ? formatCurrency(item.valor_diaria) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="font-bold text-gray-700">{item.dias_considerados}</span>
                                            <span className="text-xs text-gray-400 ml-1">dias</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900 bg-gray-50/50">
                                            {formatCurrency(item.custo_calculado)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}