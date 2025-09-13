// Caminho: components/contratos/PlanoPagamentoContrato.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCalculator } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query'; // 1. Importar useQuery

// --- FUNÇÕES DE FORMATAÇÃO E ESTILO ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: Esta função agora busca os dados para o useQuery e inclui o filtro
// de segurança `organizacaoId`, garantindo que o plano correto seja retornado.
// =================================================================================
const fetchPlanoPagamento = async (supabase, contratoId, organizacaoId) => {
    if (!contratoId || !organizacaoId) return null;
    
    const { data, error } = await supabase
        .rpc('garantir_simulacao_para_contrato', { 
            p_contrato_id: contratoId,
            p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
        })
        .single();

    if (error) {
        toast.error('Falha ao carregar o plano de pagamento: ' + error.message);
        throw new Error(error.message);
    }
    return data;
};

export default function PlanoPagamentoContrato({ contrato, onRecalculateSuccess }) {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;

    const [plano, setPlano] = useState(null);
    
    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: Substituímos a lógica antiga por useQuery. Ele gerencia o loading,
    // erros e o cache dos dados de forma automática.
    // =================================================================================
    const { data: fetchedPlano, isLoading: loading, isError } = useQuery({
        queryKey: ['planoPagamento', contrato.id, organizacaoId],
        queryFn: () => fetchPlanoPagamento(supabase, contrato.id, organizacaoId),
        enabled: !!contrato.id && !!organizacaoId,
    });

    useEffect(() => {
        if (fetchedPlano) {
            setPlano(fetchedPlano);
        }
    }, [fetchedPlano]);

    const baseValue = useMemo(() => parseFloat(contrato.valor_final_venda) || 0, [contrato.valor_final_venda]);

    const handlePlanoChange = (name, value) => {
        const newPlanoState = { ...plano };
        const numericValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;

        if (name.includes('_percentual')) {
            const valueFieldName = name.replace('_percentual', '_valor');
            newPlanoState[name] = value;
            if (baseValue > 0) {
                const calculatedValue = (numericValue / 100) * baseValue;
                newPlanoState[valueFieldName] = calculatedValue.toFixed(2);
            }
        } else if (name.includes('_valor')) {
            const percentFieldName = name.replace('_valor', '_percentual');
            newPlanoState[name] = value;
            if (baseValue > 0) {
                const calculatedPercent = (numericValue / baseValue) * 100;
                newPlanoState[percentFieldName] = parseFloat(calculatedPercent.toFixed(4));
            }
        } else {
            newPlanoState[name] = value;
        }
        setPlano(newPlanoState);
    };

    const handleSaveAndRecalculate = () => {
        toast("Confirmar Recálculo", {
            description: "Isso irá apagar as parcelas pendentes e gerar um novo cronograma. Deseja continuar?",
            action: {
                label: "Confirmar e Recalcular",
                onClick: () => {
                    if (!organizacaoId) {
                        toast.error("Erro de segurança: Organização não identificada.");
                        return;
                    }
                    const promise = new Promise(async (resolve, reject) => {
                        const { id, ...updateData } = plano;
                        
                        const { error: saveError } = await supabase.from('simulacoes').update(updateData).eq('id', id);
                        if (saveError) return reject(saveError);
                        
                        const { data: novasParcelas, error: rpcError } = await supabase.rpc('regerar_parcelas_contrato', { 
                            p_contrato_id: contrato.id,
                            p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
                        });
                        if (rpcError) return reject(rpcError);

                        resolve({ msg: "Plano salvo e cronograma recalculado!", novasParcelas });
                    });

                    toast.promise(promise, {
                        loading: 'Salvando e recalculando...',
                        success: (result) => {
                            onRecalculateSuccess(result.novasParcelas);
                            return result.msg;
                        },
                        error: (err) => `Erro: ${err.message}`
                    });
                }
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando plano...</div>;
    }

    if (isError || !plano) {
        return <div className="text-center p-10 text-red-500">Não foi possível carregar ou criar o plano de pagamento.</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Plano de Pagamento Individual</h3>
                <button onClick={handleSaveAndRecalculate} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                    <FontAwesomeIcon icon={loading ? faSpinner : faCalculator} spin={loading} /> Salvar e Recalcular
                </button>
            </div>

            <fieldset className="space-y-6">
                <legend className="text-lg font-semibold text-gray-700 sr-only">Valores e Condições</legend>
                
                <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-600 mb-3">Desconto</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Desconto (%)</label>
                            <input type="number" step="0.01" name="desconto_percentual" value={plano.desconto_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Desconto (R$)</label>
                            <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.desconto_valor || '')} onAccept={(value) => handlePlanoChange('desconto_valor', value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-600 mb-3">Entrada</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium">Entrada (%)</label><input type="number" step="0.01" name="entrada_percentual" value={plano.entrada_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Entrada (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.entrada_valor || '')} onAccept={(value) => handlePlanoChange('entrada_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_entrada" value={plano.num_parcelas_entrada || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_entrada" value={plano.data_primeira_parcela_entrada || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                </div>

                 <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-600 mb-3">Parcelas de Obra</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium">Obra (%)</label><input type="number" step="0.01" name="parcelas_obra_percentual" value={plano.parcelas_obra_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Obra (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.parcelas_obra_valor || '')} onAccept={(value) => handlePlanoChange('parcelas_obra_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_obra" value={plano.num_parcelas_obra || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_obra" value={plano.data_primeira_parcela_obra || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                </div>
            </fieldset>
        </div>
    );
}