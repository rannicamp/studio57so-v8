// components/contratos/ParcelasPagas.js
"use client";

import { useQuery } from '@tanstack/react-query'; // 1. Importar useQuery
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 2. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt } from '@fortawesome/free-solid-svg-icons';

// Funções de formatação (mantidas como estão)
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
// A data_pagamento é um timestamp, então o uso de new Date() aqui está correto.
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: Esta função agora busca os dados para o useQuery e inclui o filtro
// de segurança `organizacaoId`, garantindo que apenas os lançamentos da
// organização correta sejam retornados.
// =================================================================================
const fetchLancamentosPagos = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return [];

    const { data, error } = await supabase
        .from('lancamentos')
        .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
        .eq('favorecido_contato_id', contatoId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .eq('status', 'Pago')
        .order('data_pagamento', { ascending: false });

    if (error) {
        console.error("Erro ao buscar lançamentos pagos:", error);
        throw new Error("Falha ao buscar o histórico de pagamentos.");
    }
    return data || [];
};

export default function ParcelasPagas({ contatoId }) {
    const supabase = createClient();
    const { user } = useAuth(); // 3. Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: Substituímos a lógica antiga por useQuery. Ele gerencia o loading,
    // erros e o cache dos dados de forma automática, deixando o código mais limpo.
    // A `queryKey` inclui o `organizacaoId` para um cache seguro.
    // =================================================================================
    const { data: lancamentosPagos = [], isLoading, isError, error } = useQuery({
        queryKey: ['lancamentosPagos', contatoId, organizacaoId],
        queryFn: () => fetchLancamentosPagos(supabase, contatoId, organizacaoId),
        enabled: !!contatoId && !!organizacaoId, // A busca só é ativada quando ambos os IDs existem
    });

    if (isLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando histórico de pagamentos...</div>;
    }

    if (isError) {
        return <div className="text-center p-10 text-red-500">{error.message}</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faReceipt} /> Histórico de Pagamentos
            </h3>
            
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Data do Pagamento</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Descrição</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase">Categoria</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700 uppercase">Valor Pago</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {lancamentosPagos.length > 0 ? (
                            lancamentosPagos.map(lancamento => (
                                <tr key={lancamento.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(lancamento.data_pagamento)}</td>
                                    <td className="px-4 py-3">{lancamento.descricao}</td>
                                    <td className="px-4 py-3">{lancamento.categoria?.nome || 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(lancamento.valor)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-500">
                                    Nenhum pagamento registrado para este cliente.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}