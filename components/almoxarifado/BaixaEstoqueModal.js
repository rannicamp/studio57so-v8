// components/almoxarifado/BaixaEstoqueModal.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organização_id)
// O PORQUÊ: A função agora recebe o `organizacaoId` para filtrar os funcionários
// e garantir que apenas os funcionários da organização correta sejam listados.
// =================================================================================
const fetchFuncionarios = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('full_name');
    if (error) throw new Error("Não foi possível carregar a lista de funcionários.");
    return data;
};

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organização_id)
// O PORQUÊ: A função agora recebe o `organizacaoId` para "etiquetar" o registro
// de movimentação de estoque, garantindo que ele pertença à organização correta.
// =================================================================================
const darBaixaEstoque = async ({ supabase, estoqueItem, quantidade, observacao, usuarioId, funcionarioId, organizacaoId }) => {
    const qtdNum = parseFloat(quantidade);

    // 1. Atualiza a quantidade no item do estoque
    const novaQuantidade = estoqueItem.quantidade_atual - qtdNum;
    const { error: updateError } = await supabase
        .from('estoque')
        .update({ quantidade_atual: novaQuantidade, ultima_atualizacao: new Date().toISOString() })
        .eq('id', estoqueItem.id);

    if (updateError) throw updateError;

    // 2. Insere o registro na tabela de movimentações
    const { error: insertError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
            estoque_id: estoqueItem.id,
            tipo: 'Saída',
            quantidade: qtdNum,
            usuario_id: usuarioId,
            observacao: observacao,
            funcionario_id: funcionarioId,
            organizacao_id: organizacaoId, // <-- ETIQUETA DE SEGURANÇA!
        });

    if (insertError) throw insertError;

    return { success: true };
};


export default function BaixaEstoqueModal({ isOpen, onClose, estoqueItem, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id; // Pegamos o ID da organização
    const queryClient = useQueryClient();

    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const [funcionarioId, setFuncionarioId] = useState('');

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (queryKey e queryFn)
    // O PORQUÊ: Adicionamos o `organizacaoId` à chave da query para garantir um cache
    // único por organização e o passamos para a função de busca.
    // =================================================================================
    const { data: funcionarios, isLoading: isLoadingFuncionarios } = useQuery({
        queryKey: ['funcionarios', organizacaoId],
        queryFn: () => fetchFuncionarios(supabase, organizacaoId),
        enabled: isOpen && !!organizacaoId,
    });

    const baixaMutation = useMutation({
        mutationFn: darBaixaEstoque,
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error(`Erro ao dar baixa no estoque: ${error.message}`);
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
        
        // Passamos o `organizacaoId` para a mutation
        baixaMutation.mutate({
            supabase,
            estoqueItem,
            quantidade,
            observacao,
            usuarioId: user.id,
            funcionarioId,
            organizacaoId, // <-- Passando a "chave mestra"
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