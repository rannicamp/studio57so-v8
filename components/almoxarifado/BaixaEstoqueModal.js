// components/almoxarifado/BaixaEstoqueModal.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';

const fetchFuncionarios = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name')
        .eq('organizacao_id', organizacaoId)
        .order('full_name');
    if (error) throw new Error("Não foi possível carregar a lista de funcionários.");
    return data;
};

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (RPC)
// O PORQUÊ: A lógica foi movida para uma função no banco de dados (RPC) chamada
// `dar_baixa_estoque_por_uso`. Isso garante que a atualização do estoque e a
// inserção no histórico aconteçam de forma atômica (tudo ou nada), prevenindo
// inconsistências nos dados.
// =================================================================================
const darBaixaEstoque = async ({ supabase, estoqueItem, quantidade, observacao, usuarioId, funcionarioId, organizacaoId }) => {
    const { error } = await supabase.rpc('dar_baixa_estoque_por_uso', {
        p_estoque_id: estoqueItem.id,
        p_quantidade: parseFloat(quantidade),
        p_observacao: observacao,
        p_usuario_id: usuarioId,
        p_funcionario_id: funcionarioId,
        p_organizacao_id: organizacaoId
    });

    if (error) throw error;

    return { success: true };
};


export default function BaixaEstoqueModal({ isOpen, onClose, estoqueItem, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const [funcionarioId, setFuncionarioId] = useState('');

    const { data: funcionarios, isLoading: isLoadingFuncionarios } = useQuery({
        queryKey: ['funcionarios', organizacaoId],
        queryFn: () => fetchFuncionarios(supabase, organizacaoId),
        enabled: isOpen && !!organizacaoId,
    });

    const baixaMutation = useMutation({
        mutationFn: darBaixaEstoque, // Agora chama a função que usa a RPC
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onError: (error) => {
            // A mensagem de erro agora virá diretamente do banco de dados, sendo mais clara.
            toast.error(`Erro ao dar baixa: ${error.message}`);
        },
    });

    useEffect(() => {
        if (!isOpen) {
            setQuantidade('');
            setObservacao('');
            setFuncionarioId('');
            baixaMutation.reset();
        }
    }, [isOpen, baixaMutation]);


    const handleSave = () => {
        if (!user) {
            toast.error("Você precisa estar logado para realizar esta ação.");
            return;
        }
        const qtdNum = parseFloat(quantidade);
        if (isNaN(qtdNum) || qtdNum <= 0) {
            toast.warning("Por favor, insira uma quantidade válida.");
            return;
        }
        if (qtdNum > estoqueItem.quantidade_atual) {
            toast.error("A quantidade de saída não pode ser maior que o estoque atual.");
            return;
        }
        if (!funcionarioId) {
            toast.warning("Por favor, selecione o funcionário que fez a retirada.");
            return;
        }
        
        baixaMutation.mutate({
            supabase,
            estoqueItem,
            quantidade,
            observacao,
            usuarioId: user.id,
            funcionarioId,
            organizacaoId,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-2">Dar Baixa no Estoque</h3>
                <p className="text-sm mb-4">Item: <span className="font-semibold">{estoqueItem.material.nome}</span></p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Funcionário que fez a retirada *</label>
                        <select
                            value={funcionarioId}
                            onChange={(e) => setFuncionarioId(e.target.value)}
                            disabled={isLoadingFuncionarios}
                            className="mt-1 w-full p-2 border rounded-md"
                        >
                            <option value="">{isLoadingFuncionarios ? 'Carregando...' : 'Selecione um funcionário'}</option>
                            {funcionarios?.map(func => (
                                <option key={func.id} value={func.id}>{func.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Quantidade a ser utilizada *</label>
                        <input
                            type="number"
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md"
                            max={estoqueItem.quantidade_atual}
                            placeholder={`Disponível: ${estoqueItem.quantidade_atual}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Observação (Opcional)</label>
                        <textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            rows="3"
                            className="mt-1 w-full p-2 border rounded-md"
                            placeholder="Ex: Usado na fundação do Bloco A"
                        ></textarea>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={handleSave} disabled={baixaMutation.isPending} className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                        {baixaMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar Baixa'}
                    </button>
                </div>
            </div>
        </div>
    );
}