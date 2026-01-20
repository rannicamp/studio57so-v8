// components/contratos/ExtratoFinanceiroCliente.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, 
    faMoneyBillWave, 
    faCheckCircle, 
    faClock, 
    faExclamationCircle,
    faArrowUp,
    faArrowDown,
    facheckDouble,
    faCheckDouble
} from '@fortawesome/free-solid-svg-icons';

// Funções de formatação bonitinhas
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

// Função que busca os dados no Supabase
const fetchExtratoFinanceiro = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return [];

    // Buscamos na tabela 'lancamentos' onde o favorecido é o nosso cliente
    const { data, error } = await supabase
        .from('lancamentos')
        .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
        .eq('favorecido_contato_id', contatoId)
        .eq('organizacao_id', organizacaoId)
        .order('data_vencimento', { ascending: false }); // Ordenado por vencimento (mais recente primeiro)

    if (error) {
        console.error("Erro ao buscar extrato financeiro:", error);
        throw new Error("Falha ao buscar o histórico financeiro.");
    }
    return data || [];
};

export default function ExtratoFinanceiroCliente({ contatoId }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Carregamento Mágico dos dados (Cache + Atualização)
    const { data: lancamentos = [], isLoading, isError, error } = useQuery({
        queryKey: ['extratoFinanceiroCliente', contatoId, organizacaoId],
        queryFn: () => fetchExtratoFinanceiro(supabase, contatoId, organizacaoId),
        enabled: !!contatoId && !!organizacaoId,
    });

    if (isLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500"/> <span className="ml-2 text-gray-500">Carregando financeiro...</span></div>;
    }

    if (isError) {
        return <div className="text-center p-10 text-red-500">Erro: {error.message}</div>;
    }

    // --- CORREÇÃO AQUI ---
    // Agora consideramos 'Pago' E TAMBÉM 'Conciliado' como valor recebido
    const totalPago = lancamentos
        .filter(l => (l.status === 'Pago' || l.status === 'Conciliado') && l.tipo === 'Receita')
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);

    const totalPendente = lancamentos
        .filter(l => l.status === 'Pendente' && l.tipo === 'Receita')
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-6 animate-fade-in">
            
            {/* Cabeçalho com Resumo */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-green-600"/> 
                    Extrato Financeiro do Cliente
                </h3>
                <div className="flex gap-4 text-sm">
                    <div className="bg-green-50 px-3 py-1 rounded border border-green-200">
                        <span className="text-gray-600 block text-xs uppercase">Total Recebido (Pago + Conciliado)</span>
                        <span className="font-bold text-green-700 text-lg">{formatCurrency(totalPago)}</span>
                    </div>
                    <div className="bg-yellow-50 px-3 py-1 rounded border border-yellow-200">
                        <span className="text-gray-600 block text-xs uppercase">A Receber (Pendente)</span>
                        <span className="font-bold text-yellow-700 text-lg">{formatCurrency(totalPendente)}</span>
                    </div>
                </div>
            </div>
            
            {/* Tabela de Lançamentos */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase w-10">Tipo</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Vencimento</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Descrição</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Categoria</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700 uppercase">Valor</th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-700 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {lancamentos.length > 0 ? (
                            lancamentos.map(lancamento => {
                                // Lógica visual de Status
                                let statusColor = 'bg-gray-100 text-gray-800';
                                let statusIcon = faClock;
                                
                                if (lancamento.status === 'Pago') {
                                    statusColor = 'bg-green-100 text-green-800';
                                    statusIcon = faCheckCircle;
                                } else if (lancamento.status === 'Conciliado') {
                                    // Visual especial para Conciliado (Azul ou Verde mais escuro)
                                    statusColor = 'bg-blue-100 text-blue-800';
                                    statusIcon = faCheckDouble;
                                } else if (lancamento.status === 'Atrasado') {
                                    statusColor = 'bg-red-100 text-red-800';
                                    statusIcon = faExclamationCircle;
                                }

                                // Lógica visual de Tipo (Receita/Despesa)
                                const isReceita = lancamento.tipo === 'Receita';
                                const valorColor = isReceita ? 'text-green-600' : 'text-red-600';
                                const tipoIcon = isReceita ? faArrowUp : faArrowDown;

                                return (
                                    <tr key={lancamento.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            <FontAwesomeIcon icon={tipoIcon} className={valorColor} title={lancamento.tipo}/>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                            {formatDate(lancamento.data_vencimento)}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {lancamento.descricao}
                                            {lancamento.data_pagamento && (
                                                <div className="text-xs text-gray-400">Pago em: {formatDate(lancamento.data_pagamento)}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {lancamento.categoria?.nome || '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${valorColor}`}>
                                            {formatCurrency(lancamento.valor)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                                <FontAwesomeIcon icon={statusIcon} size="xs" />
                                                {lancamento.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-gray-500 italic">
                                    Nenhum lançamento financeiro encontrado para este cliente.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}