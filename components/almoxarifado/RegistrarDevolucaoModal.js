"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

// =================================================================================
// FUNÇÃO BLINDADA (RPC)
// O PORQUÊ: Agora chamamos a função 'registrar_devolucao_estoque' no banco.
// Ela valida se a quantidade é possível e faz a troca de saldo (Em Uso -> Disponível)
// de forma atômica e segura.
// =================================================================================
const registrarDevolucaoEquipamento = async ({ supabase, estoqueItem, quantidade, observacao, usuarioId, organizacaoId }) => {
    const qtdNum = parseFloat(quantidade);

    const { error } = await supabase.rpc('registrar_devolucao_estoque', {
        p_estoque_id: estoqueItem.id,
        p_quantidade: qtdNum,
        p_observacao: observacao,
        p_usuario_id: usuarioId,
        p_organizacao_id: organizacaoId
    });

    if (error) {
        throw new Error(error.message);
    }

    return { success: true };
};

export default function RegistrarDevolucaoModal({ isOpen, onClose, estoqueItem, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');

    const devolucaoMutation = useMutation({
        mutationFn: registrarDevolucaoEquipamento,
        onSuccess: () => {
            onSuccess(); // Atualiza a tabela
            onClose();   // Fecha modal
            toast.success("Equipamento devolvido ao estoque com sucesso!");
        },
        onError: (error) => {
            toast.error(`Erro ao registrar devolução: ${error.message}`);
        },
    });

    // Limpa os campos sempre que o modal abre/fecha
    useEffect(() => {
        if (!isOpen) {
            setQuantidade('');
            setObservacao('');
            devolucaoMutation.reset();
        }
    }, [isOpen, devolucaoMutation]);

    const handleSave = () => {
        if (!user) {
            toast.error("Sessão inválida. Recarregue a página.");
            return;
        }

        const qtdNum = parseFloat(quantidade);
        
        // Validações básicas de UI antes de enviar
        if (isNaN(qtdNum) || qtdNum <= 0) {
            toast.warning("Por favor, insira uma quantidade válida.");
            return;
        }

        if (qtdNum > estoqueItem.quantidade_em_uso) {
            toast.error(`Você não pode devolver mais do que está em uso (${estoqueItem.quantidade_em_uso}).`);
            return;
        }
        
        devolucaoMutation.mutate({
            supabase,
            estoqueItem,
            quantidade,
            observacao,
            usuarioId: user.id,
            organizacaoId,
        });
    };

    if (!isOpen || !estoqueItem) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-200">
                
                {/* Cabeçalho */}
                <div className="mb-4 border-b pb-4">
                    <h3 className="text-xl font-bold text-gray-800">Devolução de Equipamento</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Item: <span className="font-semibold text-blue-600">{estoqueItem.material?.nome}</span>
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Input Quantidade */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantidade a devolver *
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                max={estoqueItem.quantidade_em_uso}
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-2 text-xs text-gray-400 font-medium">
                                Máx: {estoqueItem.quantidade_em_uso}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Esta quantidade sairá de "Em Uso" e voltará para "Disponível".
                        </p>
                    </div>

                    {/* Input Observação */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Observação (Opcional)
                        </label>
                        <textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            rows="3"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            placeholder="Ex: Devolvido em boas condições; Limpeza necessária..."
                        ></textarea>
                    </div>
                </div>

                {/* Rodapé com Ações */}
                <div className="flex justify-end gap-3 pt-6 mt-2">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={devolucaoMutation.isPending} 
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 flex items-center gap-2"
                    >
                        {devolucaoMutation.isPending ? (
                            <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</>
                        ) : (
                            'Confirmar Devolução'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}