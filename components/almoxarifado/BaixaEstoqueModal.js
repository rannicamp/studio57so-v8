// components/almoxarifado/BaixaEstoqueModal.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

// Nova função para buscar a lista de funcionários
const fetchFuncionarios = async (supabase) => {
    const { data, error } = await supabase.from('funcionarios').select('id, full_name').order('full_name');
    if (error) throw new Error("Não foi possível carregar a lista de funcionários.");
    return data;
};

export default function BaixaEstoqueModal({ isOpen, onClose, estoqueItem, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    // ***** NOVO ESTADO PARA O FUNCIONÁRIO *****
    const [funcionarioId, setFuncionarioId] = useState('');

    // Hook para buscar os funcionários
    const { data: funcionarios, isLoading: isLoadingFuncionarios } = useQuery({
        queryKey: ['funcionarios'],
        queryFn: () => fetchFuncionarios(supabase),
        enabled: isOpen, // Só busca quando o modal está aberto
    });

    const handleSave = async () => {
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
        // ***** NOVA VALIDAÇÃO *****
        if (!funcionarioId) {
            toast.warning("Por favor, selecione o funcionário que fez a retirada.");
            return;
        }

        setIsSaving(true);
        
        try {
            const novaQuantidade = estoqueItem.quantidade_atual - qtdNum;
            const { error: updateError } = await supabase
                .from('estoque')
                .update({ quantidade_atual: novaQuantidade, ultima_atualizacao: new Date().toISOString() })
                .eq('id', estoqueItem.id);

            if (updateError) throw updateError;

            // ***** ATUALIZAÇÃO NO INSERT *****
            // Adicionamos o funcionario_id ao registro de movimentação
            const { error: insertError } = await supabase
                .from('movimentacoes_estoque')
                .insert({
                    estoque_id: estoqueItem.id,
                    tipo: 'Saída',
                    quantidade: qtdNum,
                    usuario_id: user.id,
                    observacao: observacao,
                    funcionario_id: funcionarioId, // <-- NOVA INFORMAÇÃO
                });
            
            if (insertError) throw insertError;

            onSuccess();
            onClose();

        } catch (error) {
            toast.error(`Erro ao dar baixa no estoque: ${error.message}`);
        } finally {
            setIsSaving(false);
            setQuantidade('');
            setObservacao('');
            setFuncionarioId(''); // Limpa o funcionário selecionado
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-2">Dar Baixa no Estoque</h3>
                <p className="text-sm mb-4">Item: <span className="font-semibold">{estoqueItem.material.nome}</span></p>
                <div className="space-y-4">
                    {/* ***** NOVO CAMPO DE SELEÇÃO DE FUNCIONÁRIO ***** */}
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
                    <button onClick={handleSave} disabled={isSaving} className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar Baixa'}
                    </button>
                </div>
            </div>
        </div>
    );
}