//components\financeiro\CategoriaFormModal.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function CategoriaFormModal({ isOpen, onClose, onSave, initialData, allCategories, defaultType = 'Despesa' }) {
    const isEditing = Boolean(initialData);

    const getInitialState = useCallback(() => ({
        nome: '',
        tipo: defaultType,
        parent_id: null,
    }), [defaultType]);

    const [formData, setFormData] = useState(getInitialState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? initialData : getInitialState());
        }
    }, [isOpen, initialData, isEditing, getInitialState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
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
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">
                    {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nome da Categoria *</label>
                        <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium">Tipo *</label>
                        <select name="tipo" value={formData.tipo} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                            <option>Despesa</option>
                            <option>Receita</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Subcategoria de (Opcional)</label>
                        <select name="parent_id" value={formData.parent_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Nenhuma (Categoria Principal)</option>
                            {allCategories && allCategories
                                .filter(c => !c.parent_id)
                                .map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)
                            }
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