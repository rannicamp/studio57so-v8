//components\ProdutoFormModal.js

"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function ProdutoFormModal({ isOpen, onClose, onSave, produtoToEdit }) {
    const isEditing = Boolean(produtoToEdit);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? produtoToEdit : {
                unidade: '',
                tipo: '',
                area_m2: '',
                valor_base: '',
                fator_reajuste_percentual: 0,
                status: 'Disponível',
            });
        }
    }, [isOpen, produtoToEdit, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMaskedChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await onSave(formData);
        setLoading(false);
        if (success) {
            onClose(); // Fecha o modal se o salvamento for bem-sucedido
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
                    <div>
                        <label className="block text-sm font-medium">Área (m²) *</label>
                        <IMaskInput
                            mask={Number}
                            radix=","
                            scale={2}
                            thousandsSeparator="."
                            padFractionalZeros
                            name="area_m2"
                            value={String(formData.area_m2 || '')}
                            onAccept={(unmasked) => handleMaskedChange('area_m2', unmasked)}
                            required
                            className="mt-1 w-full p-2 border rounded-md"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Valor Base (R$)</label>
                             <IMaskInput
                                mask="R$ num"
                                blocks={{
                                    num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }
                                }}
                                name="valor_base"
                                value={String(formData.valor_base || '')}
                                onAccept={(unmasked) => handleMaskedChange('valor_base', unmasked)}
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
                                onAccept={(unmasked) => handleMaskedChange('fator_reajuste_percentual', unmasked)}
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