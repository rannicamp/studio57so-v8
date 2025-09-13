//components\CondicoesPagamento.js

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext'; // <--- 1. IMPORTAMOS O 'useAuth'
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faPlus, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner'; // <-- Adicionado para notificações mais elegantes


export default function CondicoesPagamento({ empreendimentoId, initialConfig, onUpdate }) {
    const supabase = createClient();
    const { userData } = useAuth(); // <--- 2. PEGAMOS OS DADOS DO USUÁRIO LOGADO
    const [config, setConfig] = useState(initialConfig || {});
    const [parcelasAdicionais, setParcelasAdicionais] = useState(initialConfig?.parcelas_adicionais || []);
    const [novaParcela, setNovaParcela] = useState({ valor: '', data_pagamento: '' });
    
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const initial = initialConfig || {
            desconto_percentual: 0,
            entrada_percentual: 20,
            parcelas_obra_percentual: 40,
            saldo_remanescente_percentual: 40,
            num_parcelas_entrada: 3,
            num_parcelas_obra: 36,
        };
        setConfig(initial);
        setParcelasAdicionais(initialConfig?.parcelas_adicionais || []);
    }, [initialConfig]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) || 0 }));
    };
    
    const handleNovaParcelaChange = (e) => {
        const { name, value } = e.target;
        setNovaParcela(prev => ({...prev, [name]: value}));
    };
    
    const handleAddParcelaAdicional = async () => {
        if (!novaParcela.valor || !novaParcela.data_pagamento || !config.id) {
            toast.warning('Para adicionar uma parcela, primeiro salve as condições de pagamento gerais e depois preencha o valor e a data da parcela adicional.');
            return;
        }
        
        const { error } = await supabase
            .from('parcelas_adicionais')
            .insert({
                configuracao_venda_id: config.id,
                valor: parseFloat(String(novaParcela.valor).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0,
                data_pagamento: novaParcela.data_pagamento
            });

        if (error) {
            toast.error('Erro ao adicionar parcela: ' + error.message);
        } else {
            toast.success('Parcela adicional adicionada!');
            setNovaParcela({ valor: '', data_pagamento: '' });
            onUpdate();
        }
    };
    
    const handleRemoveParcelaAdicional = async (id) => {
        const { error } = await supabase.from('parcelas_adicionais').delete().eq('id', id);
        if (error) {
            toast.error('Erro ao remover parcela: ' + error.message);
        } else {
            toast.success('Parcela adicional removida.');
            onUpdate();
        }
    };

    const handleSave = async () => {
        setSaving(true);

        // ---> 3. AQUI ESTÁ A MUDANÇA MÁGICA <---
        if (!userData?.organizacao_id) {
            toast.error('Erro de segurança: Organização do usuário não encontrada. Por favor, faça login novamente.');
            setSaving(false);
            return;
        }

        const { id, created_at, parcelas_adicionais, ...dataToUpsert } = config;

        // Adicionamos o "carimbo" da organização aos dados que serão salvos.
        dataToUpsert.organizacao_id = userData.organizacao_id;

        const { error } = await supabase
            .from('configuracoes_venda')
            .upsert({ ...dataToUpsert, empreendimento_id: empreendimentoId }, { onConflict: 'empreendimento_id' });

        if (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } else {
            toast.success('Condições de pagamento salvas com sucesso!');
            onUpdate();
        }
        setSaving(false);
    };

    const totalPercent = useMemo(() => {
        return (
            Number(config.entrada_percentual || 0) +
            Number(config.parcelas_obra_percentual || 0) +
            Number(config.saldo_remanescente_percentual || 0)
        );
    }, [config]);

    return (
        <div className="space-y-6">
            <div className="space-y-8">
                 <fieldset>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Desconto (%):</label>
                            <input type="number" name="desconto_percentual" value={config.desconto_percentual || 0} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-gray-50" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Entrada (%):</label>
                            <input type="number" name="entrada_percentual" value={config.entrada_percentual || 0} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Parcelas Obra (%):</label>
                            <input type="number" name="parcelas_obra_percentual" value={config.parcelas_obra_percentual || 0} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Saldo Rem. (%):</label>
                            <input type="number" name="saldo_remanescente_percentual" value={config.saldo_remanescente_percentual || 0} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                    {totalPercent !== 100 && (
                        <div className="mt-3 text-right text-sm flex items-center justify-end gap-2 text-yellow-700 bg-yellow-50 p-2 rounded-md">
                           <FontAwesomeIcon icon={faInfoCircle} />
                           <span>A soma dos percentuais (Entrada, Obra, Saldo) é de <strong>{totalPercent}%</strong>. O ideal é que a soma seja 100%.</span>
                        </div>
                    )}
                </fieldset>
                
                <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border-t pt-6">
                    <div>
                        <legend className="text-base font-semibold text-gray-800 mb-2">Detalhes da Entrada</legend>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nº de Parcelas:</label>
                                <input type="number" name="num_parcelas_entrada" value={config.num_parcelas_entrada || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Data da 1ª Parcela:</label>
                                <input type="date" name="data_primeira_parcela_entrada" value={config.data_primeira_parcela_entrada || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>
                     <div>
                        <legend className="text-base font-semibold text-gray-800 mb-2">Detalhes das Parcelas da Obra</legend>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nº de Parcelas:</label>
                                <input type="number" name="num_parcelas_obra" value={config.num_parcelas_obra || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Data da 1ª Parcela:</label>
                                <input type="date" name="data_primeira_parcela_obra" value={config.data_primeira_parcela_obra || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>
                </fieldset>
                
                <fieldset>
                     <legend className="text-lg font-semibold text-gray-800 border-t pt-4 mb-4">Parcelas Adicionais / Intermediárias</legend>
                    <div className="space-y-3 mb-4">
                        {parcelasAdicionais.map(p => (
                            <div key={p.id} className="flex items-center gap-4 bg-gray-100 p-2 rounded-md text-sm">
                                <span className="flex-grow">Valor: <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor)}</strong></span>
                                <span className="flex-grow">Data: <strong>{new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
                                <button type="button" onClick={() => handleRemoveParcelaAdicional(p.id)}><FontAwesomeIcon icon={faTrash} className="text-red-500 hover:text-red-700" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-end gap-4 p-4 border rounded-md bg-gray-50">
                        <div className="flex-grow">
                             <label className="block text-sm font-medium text-gray-700">Valor (R$):</label>
                             <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}}
                                name="valor"
                                value={novaParcela.valor}
                                onAccept={(value) => setNovaParcela(prev => ({ ...prev, valor: value }))}
                                className="mt-1 w-full p-2 border rounded-md"
                                placeholder="R$ 10.000,00"
                            />
                        </div>
                         <div className="flex-grow">
                             <label className="block text-sm font-medium text-gray-700">Data de Pagamento:</label>
                             <input type="date" name="data_pagamento" value={novaParcela.data_pagamento} onChange={handleNovaParcelaChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <button type="button" onClick={handleAddParcelaAdicional} className="bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 flex items-center gap-2 h-fit">
                            <FontAwesomeIcon icon={faPlus} /> Adicionar
                        </button>
                    </div>
                </fieldset>
                
                <div className="flex justify-end pt-6 border-t">
                    <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {saving ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Salvando...</> : 'Salvar Condições'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é um formulário para gerenciar as condições de pagamento padrão
// de um empreendimento específico (tabela 'configuracoes_venda'). Ele permite
// definir percentuais e prazos para entrada, parcelas de obra e saldo, além de
// gerenciar parcelas adicionais (intermediárias) vinculadas a essa configuração.
// --------------------------------------------------------------------------------