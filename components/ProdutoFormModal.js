"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function ProdutoFormModal({ isOpen, onClose, onSave, produtoToEdit }) {
    const isEditing = Boolean(produtoToEdit);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    // Guarda qual campo foi o último a ser editado pelo usuário
    const [lastUserInput, setLastUserInput] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? produtoToEdit : {
                unidade: '',
                tipo: '',
                area_m2: '',
                preco_m2: '', // Novo campo
                valor_base: '',
                fator_reajuste_percentual: 0,
                status: 'Disponível',
            });
            setLastUserInput(null); // Reseta o controle ao abrir o modal
        }
    }, [isOpen, produtoToEdit, isEditing]);

    // =================================================================================
    // LÓGICA DE CÁLCULO AUTOMÁTICO ADICIONADA AQUI
    // O PORQUÊ: Este useEffect observa mudanças nos campos numéricos e recalcula
    // os valores de `preco_m2` ou `valor_base` para mantê-los sempre sincronizados,
    // respeitando a última entrada do usuário para evitar loops infinitos.
    // =================================================================================
    useEffect(() => {
        if (!formData.area_m2) return;

        // Converte os valores do formulário (que são strings) para números
        const area = parseFloat(String(formData.area_m2).replace(/\./g, '').replace(',', '.')) || 0;
        const precoM2 = parseFloat(String(formData.preco_m2).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        const valorBase = parseFloat(String(formData.valor_base).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

        if (area > 0) {
            // Se o último campo editado foi Preço/m² ou a Área, calcula o Valor Base
            if (lastUserInput === 'preco_m2' || lastUserInput === 'area_m2_preco') {
                const novoValorBase = (area * precoM2).toFixed(2);
                setFormData(prev => ({ ...prev, valor_base: novoValorBase.replace('.', ',') }));
            }
            // Se o último campo editado foi o Valor Base ou a Área, calcula o Preço/m²
            else if (lastUserInput === 'valor_base' || lastUserInput === 'area_m2_valor') {
                if (valorBase > 0) {
                    const novoPrecoM2 = (valorBase / area).toFixed(2);
                    setFormData(prev => ({ ...prev, preco_m2: novoPrecoM2.replace('.', ',') }));
                }
            }
        }
    }, [formData.area_m2, formData.preco_m2, formData.valor_base, lastUserInput]);


    const handleMaskedChange = (name, value) => {
        // Atualiza qual campo o usuário está editando
        if (name === 'preco_m2') setLastUserInput('preco_m2');
        if (name === 'valor_base') setLastUserInput('valor_base');
        // Identifica se a área foi alterada para decidir qual campo recalcular
        if (name === 'area_m2') {
            const precoM2 = parseFloat(String(formData.preco_m2).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
            if (precoM2 > 0) {
                setLastUserInput('area_m2_preco');
            } else {
                setLastUserInput('area_m2_valor');
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await onSave(formData);
        setLoading(false);
        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">
                    {isEditing ? `Editar Produto (Unidade ${produtoToEdit?.unidade || ''})` : 'Adicionar Novo Produto'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Unidade *</label>
                            <input type="text" name="unidade" value={formData.unidade || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Tipo *</label>
                            <input type="text" name="tipo" value={formData.tipo || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: TIPO 1, COBERTURA" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Área (m²) *</label>
                            <IMaskInput
                                mask="num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}}
                                name="area_m2"
                                value={String(formData.area_m2 || '')}
                                onAccept={(value) => handleMaskedChange('area_m2', value)}
                                required
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        {/* ================================================================================= */}
                        {/* NOVO CAMPO ADICIONADO AQUI */}
                        {/* ================================================================================= */}
                        <div>
                            <label className="block text-sm font-medium">Preço/m² (R$)</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}}
                                name="preco_m2"
                                value={String(formData.preco_m2 || '')}
                                onAccept={(value) => handleMaskedChange('preco_m2', value)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Valor Base (R$)</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}}
                                name="valor_base"
                                value={String(formData.valor_base || '')}
                                onAccept={(value) => handleMaskedChange('valor_base', value)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Fator de Reajuste (%)</label>
                            <IMaskInput
                                mask={Number}
                                radix=","
                                scale={2}
                                name="fator_reajuste_percentual"
                                value={String(formData.fator_reajuste_percentual || 0)}
                                onAccept={(value) => handleMaskedChange('fator_reajuste_percentual', value)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Status Inicial</label>
                        <select name="status" value={formData.status || 'Disponível'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option>Disponível</option>
                            <option>Reservado</option>
                            <option>Vendido</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}