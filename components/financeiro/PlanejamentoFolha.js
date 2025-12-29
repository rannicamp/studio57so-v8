"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faExclamationTriangle, faFileInvoiceDollar, 
    faSearch, faUsers, faInfoCircle, faClock, faPlusCircle
} from '@fortawesome/free-solid-svg-icons';

const fetchAuditoriaFolha = async (organizacao_id, filters) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    
    const hoje = new Date();
    const dataInicio = filters?.startDate || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const dataFim = filters?.endDate || new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('get_auditoria_folha', {
        p_organizacao_id: organizacao_id,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
    });

    if (error) {
        console.error("Erro Auditoria Folha:", error);
        throw new Error(error.message);
    }
    return data || [];
};

export default function PlanejamentoFolha({ filters }) {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: folhaCalculada, isLoading, isError, error } = useQuery({
        queryKey: ['folhaAuditoria', user?.organizacao_id, filters?.startDate, filters?.endDate], 
        queryFn: () => fetchAuditoriaFolha(user?.organizacao_id, filters),
        enabled: !!user?.organizacao_id,
        staleTime: 1000 * 60 * 5 
    });

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    const dadosFiltrados = useMemo(() => {
        if (!folhaCalculada) return [];
        return folhaCalculada.filter(item => 
            (item.out_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.out_cargo || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [folhaCalculada, searchTerm]);

    const totalCustoPrevisto = dadosFiltrados.reduce((acc, item) => acc + (item.out_custo_previsto || 0), 0);

    // Função para calcular o valor estimado do extra só para exibir no tooltip
    const calcularValorExtra = (item) => {
        const valorDia = item.out_modelo_contratacao === 'Diarista' ? item.out_valor_diaria : (item.out_salario_base / 30);
        return (valorDia * 1.5 * item.out_dias_extras);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        Auditoria de Folha (Com Extras 1.5x)
                    </h2>
                    <p className="text-sm text-gray-500">
                        Cálculo: Contrato + Extras (Sáb/Dom/Folgas) - Faltas.
                    </p>
                </div>

                <div className="relative w-full md:w-64">
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
            </div>

            {/* Totalizador */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-blue-800">Custo Total Projetado</p>
                        <p className="text-xs text-blue-600">Inclui adicionais de dias extras</p>
                    </div>
                </div>
                <h3 className="text-3xl font-bold text-blue-900">{formatCurrency(totalCustoPrevisto)}</h3>
            </div>

            {/* Tabela Detalhada */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                        <p>Calculando horas, faltas e extras...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center p-12 text-red-500 bg-red-50">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
                        <p>Erro na auditoria.</p>
                        <p className="text-xs text-gray-400 mt-2">{error?.message}</p>
                    </div>
                ) : dadosFiltrados.length === 0 ? (
                    <div className="text-center p-12 text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="text-4xl mb-3 text-gray-300" />
                        <p>Nenhum funcionário encontrado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Funcionário</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">Regra</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                                        Horas Úteis<br/><span className="text-[10px] text-gray-400 font-normal">(Previsto)</span>
                                    </th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                                        Faltas<br/><span className="text-[10px] text-gray-400 font-normal">(Dias)</span>
                                    </th>
                                    {/* COLUNA DE EXTRAS */}
                                    <th className="px-4 py-3 text-center font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50">
                                        Extras (1.5x)<br/><span className="text-[10px] text-indigo-400 font-normal">(Fora da Jornada)</span>
                                    </th>
                                    <th className="px-4 py-3 text-right font-bold text-gray-700 uppercase tracking-wider bg-gray-100">Custo Final</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dadosFiltrados.map((item) => (
                                    <tr key={item.out_funcionario_id} className="hover:bg-gray-50 transition-colors">
                                        {/* NOME E CARGO */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-bold text-gray-900">{item.out_nome}</div>
                                            <div className="text-gray-500">{item.out_cargo}</div>
                                            {item.out_observacao && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 mt-1">
                                                    <FontAwesomeIcon icon={faInfoCircle} className="mr-1" />
                                                    {item.out_observacao}
                                                </span>
                                            )}
                                        </td>

                                        {/* TIPO DE CONTRATO */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.out_modelo_contratacao === 'Diarista' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'}`}>
                                                {item.out_modelo_contratacao}
                                            </span>
                                            <div className="text-[10px] text-gray-500 mt-1">
                                                {item.out_modelo_contratacao === 'Diarista' ? `${formatCurrency(item.out_valor_diaria)}/dia` : formatCurrency(item.out_salario_base)}
                                            </div>
                                        </td>
                                        
                                        {/* HORAS PREVISTAS (CONTRATO) */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-medium text-gray-700">{item.out_horas_previstas}h</span>
                                                <span className="text-[10px] text-gray-400">({item.out_dias_uteis_previstos} dias)</span>
                                            </div>
                                        </td>

                                        {/* FALTAS */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            {item.out_dias_faltas > 0 ? (
                                                <span className="px-2 py-1 inline-flex font-bold rounded-full bg-red-100 text-red-600">
                                                    {item.out_dias_faltas} dias
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        {/* EXTRAS (O Novo Destaque) */}
                                        <td className="px-4 py-3 whitespace-nowrap text-center bg-indigo-50/30 border-l border-r border-indigo-100">
                                            {item.out_dias_extras > 0 ? (
                                                <div className="flex flex-col items-center group relative cursor-help">
                                                    <span className="px-2 py-1 inline-flex items-center gap-1 font-bold rounded-full bg-indigo-100 text-indigo-700">
                                                        <FontAwesomeIcon icon={faPlusCircle} />
                                                        {item.out_dias_extras} dias
                                                    </span>
                                                    <span className="text-[10px] text-indigo-500 mt-1">
                                                        Total: {item.out_horas_extras}h
                                                    </span>
                                                    {/* Tooltip simples de valor */}
                                                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                        +{formatCurrency(calcularValorExtra(item))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        {/* CUSTO FINAL */}
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-gray-900 bg-gray-50/50">
                                            {formatCurrency(item.out_custo_previsto)}
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