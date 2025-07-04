"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function ContaFormModal({ isOpen, onClose, onSave, initialData }) {
    const isEditing = Boolean(initialData);
    
    const getInitialState = () => ({
        nome: '',
        tipo: 'Conta Corrente',
        saldo_inicial: '',
        instituicao: '',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? initialData : getInitialState());
        }
    }, [isOpen, initialData, isEditing]);

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
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">
                    {isEditing ? 'Editar Conta' : 'Adicionar Nova Conta'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nome da Conta *</label>
                        <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Conta Principal, Cartão Nubank" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Tipo de Conta</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option>Conta Corrente</option>
                                <option>Cartão de Crédito</option>
                                <option>Dinheiro</option>
                                <option>Investimento</option>
                                <option>Outro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Saldo Inicial *</label>
                             <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}}
                                name="saldo_inicial"
                                value={String(formData.saldo_inicial || '')}
                                onAccept={(unmasked) => handleMaskedChange('saldo_inicial', unmasked)}
                                required
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Instituição Financeira</label>
                        <input type="text" name="instituicao" value={formData.instituicao || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Bradesco, Itaú, NuBank..." />
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}