// components/almoxarifado/HistoricoMovimentacoesModal.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organizacao_id)
// O PORQUÊ: Adicionamos o `organizacaoId` para garantir que a busca pelo histórico
// seja restrita à organização do usuário, criando uma camada extra de segurança.
// =================================================================================
const fetchHistorico = async (supabase, estoqueId, organizacaoId) => {
    if (!estoqueId || !organizacaoId) return [];
    
    const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select(`
            *,
            usuario:usuarios(id, nome, sobrenome),
            pedido:pedidos_compra(id, titulo),
            funcionario:funcionarios(id, full_name)
        `)
        .eq('estoque_id', estoqueId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('data_movimentacao', { ascending: false });
    
    if (error) throw new Error('Falha ao buscar histórico: ' + error.message);
    return data || [];
};

export default function HistoricoMovimentacoesModal({ isOpen, onClose, estoqueItem }) {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (queryKey e queryFn)
    // O PORQUÊ: Adicionamos o `organizacaoId` à chave da query e o passamos para
    // a função de busca, garantindo um cache seguro e uma consulta correta.
    // =================================================================================
    const { data: historico, isLoading, isError, error } = useQuery({
        queryKey: ['historicoMovimentacoes', estoqueItem?.id, organizacaoId],
        queryFn: () => fetchHistorico(supabase, estoqueItem.id, organizacaoId),
        enabled: isOpen && !!estoqueItem?.id && !!organizacaoId,
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold">Histórico de Movimentações</h3>
                        <p className="text-sm">Item: <span className="font-semibold">{estoqueItem.material.nome}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                    {isLoading ? (
                        <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : isError ? (
                        <div className="text-center p-10 text-red-600">{error.message}</div>
                    ) : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left">Data</th>
                                    <th className="p-2 text-left">Tipo</th>
                                    <th className="p-2 text-center">Qtd.</th>
                                    <th className="p-2 text-left">Responsável / Origem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {historico.length === 0 ? (
                                    <tr><td colSpan="4" className="p-4 text-center text-gray-500">Nenhuma movimentação encontrada.</td></tr>
                                ) : (
                                    historico.map(mov => (
                                        <tr key={mov.id}>
                                            <td className="p-2">{formatDate(mov.data_movimentacao)}</td>
                                            <td className={`p-2 font-semibold flex items-center gap-2 ${mov.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                                                <FontAwesomeIcon icon={mov.tipo === 'Entrada' ? faArrowUp : faArrowDown} />
                                                {mov.tipo}
                                            </td>
                                            <td className="p-2 text-center font-bold">{mov.quantidade}</td>
                                            <td className="p-2">{mov.tipo === 'Entrada' ? `Pedido #${mov.pedido_compra_id}` : (mov.funcionario?.full_name || 'N/A')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                 <div className="flex justify-end pt-4 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Fechar</button>
                </div>
            </div>
        </div>
    );
}