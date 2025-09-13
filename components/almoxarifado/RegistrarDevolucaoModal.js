// components/almoxarifado/RegistrarDevolucaoModal.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organizacao_id)
// O PORQUÊ: A função agora recebe o `organizacaoId` para "etiquetar" o registro
// de movimentação, garantindo que a devolução seja atribuída à organização correta.
// =================================================================================
const registrarDevolucaoEquipamento = async ({ supabase, estoqueItem, quantidade, observacao, usuarioId, organizacaoId }) => {
    const qtdNum = parseFloat(quantidade);

    // 1. Atualiza as quantidades no item do estoque
    const novaQuantidadeAtual = estoqueItem.quantidade_atual + qtdNum;
    const novaQuantidadeEmUso = estoqueItem.quantidade_em_uso - qtdNum;
    
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
    const { error: insertError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
            estoque_id: estoqueItem.id,
            tipo: 'Devolução ao Estoque',
            quantidade: qtdNum,
            usuario_id: usuarioId,
            observacao: observacao,
            organizacao_id: organizacaoId, // <-- ETIQUETA DE SEGURANÇA!
        });

    if (insertError) throw insertError;

    return { success: true };
};


export default function RegistrarDevolucaoModal({ isOpen, onClose, estoqueItem, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id; // Pegamos o ID da organização

    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');

    const devolucaoMutation = useMutation({
        mutationFn: registrarDevolucaoEquipamento,
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error(`Erro ao registrar devolução: ${error.message}`);
        },
    });

    useEffect(() => {
        if (!isOpen) {
            setQuantidade('');
            setObservacao('');
            devolucaoMutation.reset();
        }
    }, [isOpen, devolucaoMutation]);


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
        if (qtdNum > estoqueItem.quantidade_em_uso) {
            toast.error("A quantidade de devolução não pode ser maior que a quantidade em uso.");
            return;
        }
        
        // Passamos o `organizacaoId` para a mutation
        devolucaoMutation.mutate({
            supabase,
            estoqueItem,
            quantidade,
            observacao,
            usuarioId: user.id,
            organizacaoId, // <-- Passando a "chave mestra"
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-2">Registrar Devolução ao Estoque</h3>
                <p className="text-sm mb-4">Equipamento: <span className="font-semibold">{estoqueItem.material.nome}</span></p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Quantidade a ser devolvida *</label>
                        <input
                            type="number"
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md"
                            max={estoqueItem.quantidade_em_uso}
                            placeholder={`Em uso: ${estoqueItem.quantidade_em_uso}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Observação (Opcional)</label>
                        <textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            rows="3"
                            className="mt-1 w-full p-2 border rounded-md"
                            placeholder="Ex: Devolvido em perfeitas condições após uso na fachada"
                        ></textarea>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={handleSave} disabled={devolucaoMutation.isPending} className="bg-green-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                        {devolucaoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar Devolução'}
                    </button>
                </div>
            </div>
        </div>
    );
}