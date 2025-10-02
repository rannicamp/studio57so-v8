// components/almoxarifado/HistoricoMovimentacoesModal.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

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
        .eq('organizacao_id', organizacaoId)
        .order('data_movimentacao', { ascending: false });
    
    if (error) throw new Error('Falha ao buscar histórico: ' + error.message);
    return data || [];
};

export default function HistoricoMovimentacoesModal({ isOpen, onClose, estoqueItem }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: historico, isLoading, isError, error } = useQuery({
        queryKey: ['historicoMovimentacoes', estoqueItem?.id, organizacaoId],
        queryFn: () => fetchHistorico(supabase, estoqueItem.id, organizacaoId),
        enabled: isOpen && !!estoqueItem?.id && !!organizacaoId,
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // =================================================================================
    // CORREÇÃO DA LÓGICA DE EXIBIÇÃO
    // O PORQUÊ: As funções agora verificam os tipos de movimentação de forma mais
    // completa, garantindo que a cor, o ícone e as informações de responsável
    // sejam exibidos corretamente para todos os casos definidos no banco de dados.
    // =================================================================================
    const isEntrada = (tipo) => ['Entrada por Compra', 'Devolução ao Estoque'].includes(tipo);

    const getResponsavelOrigem = (mov) => {
        if (mov.tipo === 'Entrada por Compra') {
            return `Pedido de Compra #${mov.pedido_compra_id}`;
        }
        if (mov.funcionario) {
            return mov.funcionario.full_name;
        }
        if (mov.usuario) {
            return `${mov.usuario.nome} ${mov.usuario.sobrenome}`;
        }
        return 'Sistema';
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
                                            <td className={`p-2 font-semibold flex items-center gap-2 ${isEntrada(mov.tipo) ? 'text-green-600' : 'text-red-600'}`}>
                                                <FontAwesomeIcon icon={isEntrada(mov.tipo) ? faArrowUp : faArrowDown} />
                                                {mov.tipo}
                                            </td>
                                            <td className="p-2 text-center font-bold">{mov.quantidade}</td>
                                            <td className="p-2">{getResponsavelOrigem(mov)}</td>
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