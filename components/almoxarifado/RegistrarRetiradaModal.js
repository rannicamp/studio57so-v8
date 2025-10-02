// components/almoxarifado/RegistrarRetiradaModal.js
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

const registrarRetiradaEquipamento = async ({ supabase, estoqueItem, quantidade, observacao, usuarioId, funcionarioId, organizacaoId }) => {
    const qtdNum = parseFloat(quantidade);

    // 1. Atualiza as quantidades no item do estoque
    const novaQuantidadeAtual = estoqueItem.quantidade_atual - qtdNum;
    const novaQuantidadeEmUso = (estoqueItem.quantidade_em_uso || 0) + qtdNum;
    
    const { error: updateError } = await supabase
        .from('estoque')
        .update({ 
            quantidade_atual: novaQuantidadeAtual,
            quantidade_em_uso: novaQuantidadeEmUso,
            ultima_atualizacao: new Date().toISOString() 
        })
        .eq('id', estoqueItem.id);

    if (updateError) throw updateError;

    // 2. Insere o registro na tabela de movimentações
    // =================================================================================
    // CORREÇÃO DO ERRO DE BAIXA (DE NOVO!)
    // O PORQUÊ: O tipo de movimentação precisa corresponder EXATAMENTE ao valor
    // definido na regra do banco de dados para passar na validação de segurança.
    // =================================================================================
    const { error: insertError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
            estoque_id: estoqueItem.id,
            tipo: 'Retirada por Funcionário', // <-- GARANTINDO O VALOR CORRETO
            quantidade: qtdNum,
            usuario_id: usuarioId,
            observacao: observacao,
            funcionario_id: funcionarioId,
            organizacao_id: organizacaoId,
        });

    if (insertError) throw insertError;

    return { success: true };
};


export default function RegistrarRetiradaModal({ isOpen, onClose, estoqueItem, onSuccess }) {
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

    const retiradaMutation = useMutation({
        mutationFn: registrarRetiradaEquipamento,
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error(`Erro ao registrar retirada: ${error.message}`);
        },
    });

    useEffect(() => {
        if (!isOpen) {
            setQuantidade('');
            setObservacao('');
            setFuncionarioId('');
            retiradaMutation.reset();
        }
    }, [isOpen, retiradaMutation]);


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
            toast.error("A quantidade de retirada não pode ser maior que o estoque disponível.");
            return;
        }
        if (!funcionarioId) {
            toast.warning("Por favor, selecione o funcionário que está retirando o equipamento.");
            return;
        }
        
        retiradaMutation.mutate({
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
                <h3 className="text-xl font-bold mb-2">Registrar Retirada de Equipamento</h3>
                <p className="text-sm mb-4">Equipamento: <span className="font-semibold">{estoqueItem.material.nome}</span></p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Funcionário Responsável *</label>
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
                        <label className="block text-sm font-medium">Quantidade a ser retirada *</label>
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
                            placeholder="Ex: Retirado para uso na fachada do Bloco B"
                        ></textarea>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={handleSave} disabled={retiradaMutation.isPending} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                        {retiradaMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar Retirada'}
                    </button>
                </div>
            </div>
        </div>
    );
}