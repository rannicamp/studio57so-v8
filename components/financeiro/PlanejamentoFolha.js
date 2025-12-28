"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faExclamationTriangle, faFileInvoiceDollar, 
    faSearch, faUsers, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

// Função auxiliar para converter datas com segurança
const parseDateSafe = (dateValue) => {
    if (!dateValue) return null;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return null;
    return d;
};

const fetchDadosFolha = async (organizacao_id) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    
    // CORREÇÃO: Removemos 'contract_role' que não existe mais.
    // Buscamos apenas os relacionamentos corretos.
    const { data, error } = await supabase
        .from('funcionarios')
        .select(`
            id, 
            full_name, 
            admission_date, 
            demission_date, 
            status,
            cargos ( nome ), 
            historico_salarial ( salario_base, valor_diaria, data_inicio_vigencia )
        `)
        .eq('organizacao_id', organizacao_id)
        .order('full_name');

    if (error) {
        console.error("Erro Supabase Folha:", error);
        throw new Error(error.message);
    }
    return data || [];
};

export default function PlanejamentoFolha({ filters }) {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Definição do Período
    const periodo = useMemo(() => {
        const hoje = new Date();
        // Se não vier filtro, pega o mês atual
        const inicio = filters?.startDate || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const fim = filters?.endDate || new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
        return { inicio, fim };
    }, [filters]);

    // 2. Busca de Dados
    const { data: rawData, isLoading, isError, error } = useQuery({
        queryKey: ['folhaBase', user?.organizacao_id], 
        queryFn: () => fetchDadosFolha(user?.organizacao_id),
        enabled: !!user?.organizacao_id,
        staleTime: 1000 * 60 * 5 
    });

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    // 3. Processamento
    const folhaProcessada = useMemo(() => {
        if (!rawData) return [];

        return rawData.filter(func => {
            // A. Filtro de Texto (Nome ou Cargo)
            const termo = searchTerm.toLowerCase();
            const nomeMatch = func.full_name?.toLowerCase().includes(termo);
            // Agora pegamos o cargo apenas da relação 'cargos'
            const nomeCargo = func.cargos?.nome || '';
            const cargoMatch = nomeCargo.toLowerCase().includes(termo);
            
            if (searchTerm && !nomeMatch && !cargoMatch) {
                return false;
            }

            // B. Filtro de Atividade no Período
            const dataDemissao = parseDateSafe(func.demission_date);
            const dataAdmissao = parseDateSafe(func.admission_date);
            
            const filtroInicio = new Date(periodo.inicio + 'T00:00:00');
            const filtroFim = new Date(periodo.fim + 'T23:59:59');

            // Regra 1: Se foi demitido ANTES do período começar, tchau.
            if (dataDemissao && dataDemissao < filtroInicio) return false;
            
            // Regra 2: Se foi admitido DEPOIS do período acabar, tchau.
            if (dataAdmissao && dataAdmissao > filtroFim) return false;

            return true;
        }).map(func => {
            // C. Pega o Salário Vigente (Histórico mais recente)
            const historico = func.historico_salarial?.sort((a, b) => {
                const dateA = new Date(a.data_inicio_vigencia || 0);
                const dateB = new Date(b.data_inicio_vigencia || 0);
                return dateB - dateA;
            })[0] || { salario_base: 0, valor_diaria: 0 };

            return {
                id: func.id,
                nome: func.full_name,
                // CORREÇÃO: Usa apenas o nome vindo da tabela cargos
                cargo: func.cargos?.nome || 'Cargo não definido',
                salario_base: Number(historico.salario_base),
                diaria: Number(historico.valor_diaria),
                status: func.status,
                admissao: func.admission_date,
                demissao: func.demission_date
            };
        });
    }, [rawData, searchTerm, periodo]);

    const totalSalarioBase = folhaProcessada.reduce((acc, item) => acc + (item.salario_base || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        Planejamento de Folha (Base)
                    </h2>
                    <p className="text-sm text-gray-500">
                        Funcionários ativos entre <strong>{new Date(periodo.inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> e <strong>{new Date(periodo.fim + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
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

            {/* Tabela */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                        <p>Carregando dados da equipe...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center p-12 text-red-500 bg-red-50">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
                        <p>Erro ao carregar lista de funcionários.</p>
                        <p className="text-xs text-gray-400 mt-2">Detalhe: {error?.message}</p>
                    </div>
                ) : folhaProcessada.length === 0 ? (
                    <div className="text-center p-12 text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="text-4xl mb-3 text-gray-300" />
                        <p>Nenhum funcionário ativo encontrado para este período.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Cargo</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Salário Base</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Diária</th>
                                    <th className="px-6 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">Situação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {folhaProcessada.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {item.nome}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {item.cargo}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 font-medium">
                                            {item.salario_base > 0 ? formatCurrency(item.salario_base) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 font-medium">
                                            {item.diaria > 0 ? formatCurrency(item.diaria) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {item.demissao ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                        Demitido
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 mt-1">{new Date(item.demissao).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            ) : (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Ativo
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan="2" className="px-6 py-3 text-right font-bold text-gray-700">Total Salários Base:</td>
                                    <td className="px-6 py-3 text-right font-bold text-blue-700">{formatCurrency(totalSalarioBase)}</td>
                                    <td colSpan="2" className="px-6 py-3 text-xs text-gray-400 italic text-center">
                                        *Não inclui valor variável de diárias
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}