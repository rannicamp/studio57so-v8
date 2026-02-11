"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUndo, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function EstornoMovimentacaoModal({ isOpen, onClose, movimentacao, onSuccess }) {
    const [quantidade, setQuantidade] = useState('');
    const [motivo, setMotivo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();

    if (!isOpen || !movimentacao) return null;

    const handleSalvar = async () => {
        if (!quantidade || parseFloat(quantidade) <= 0) {
            toast.error("Informe uma quantidade válida.");
            return;
        }
        if (parseFloat(quantidade) > movimentacao.quantidade) {
            toast.error("Você não pode estornar mais do que a quantidade original.");
            return;
        }
        if (!motivo.trim()) {
            toast.error("Por favor, informe o motivo do estorno.");
            return;
        }

        try {
            setIsSubmitting(true);
            
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.rpc('realizar_estorno_movimentacao', {
                p_movimentacao_id: movimentacao.id,
                p_quantidade_estorno: parseFloat(quantidade),
                p_motivo: motivo,
                p_usuario_id: user.id
            });

            if (error) throw error;

            onSuccess();
            onClose();
            toast.success("Estorno realizado com sucesso! O item voltou ao estoque.");
        } catch (error) {
            console.error('Erro ao estornar:', error);
            toast.error("Erro ao realizar estorno: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                
                {/* Header Laranja para Atenção */}
                <div className="flex justify-between items-center p-4 border-b border-orange-100 bg-orange-50 rounded-t-lg">
                    <h3 className="font-bold text-orange-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUndo} />
                        Estornar / Devolver Item
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Resumo do Item */}
                    <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 border border-gray-200">
                        <p className="font-semibold">{movimentacao.estoque?.materiais?.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Movimentação Original: <strong>{movimentacao.tipo}</strong> <br/>
                            Quantidade Original: <strong>{movimentacao.quantidade} {movimentacao.estoque?.materiais?.unidade_medida}</strong><br/>
                            Data: {new Date(movimentacao.data_movimentacao).toLocaleDateString()}
                        </p>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 flex gap-2 items-start border border-yellow-100">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5" />
                        <p>Esta ação devolverá os itens para o estoque disponível e corrigirá o saldo do funcionário/obra.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade a Estornar</label>
                        <input
                            type="number"
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                            placeholder={`Máximo: ${movimentacao.quantidade}`}
                            max={movimentacao.quantidade}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Justificativa</label>
                        <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            rows={3}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                            placeholder="Ex: Material sobrou, lançamento errado..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSalvar}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar Estorno'}
                    </button>
                </div>
            </div>
        </div>
    );
}