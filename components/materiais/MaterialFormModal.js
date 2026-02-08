//components\MaterialFormModal.js

'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../../utils/supabase/client';

export default function MaterialFormModal({ isOpen, onClose, onSave, material, fornecedores }) {
    const supabase = createClient();
    const isEditing = Boolean(material?.id); // Verificação mais segura

    const getInitialState = () => ({
        // ***** CAMPO ADICIONADO AO ESTADO INICIAL *****
        classificacao: 'Insumo', // 'Insumo' é o valor padrão
        nome: '',
        descricao: '',
        unidade_medida: '',
        preco_unitario: '',
        empresa_fornecedor_id: null,
        Grupo: '',
        'Código da Composição': '',
        Origem: ''
    });

    const [formData, setFormData] = useState(getInitialState());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Se estiver editando um material, carrega os dados dele.
            // Se for um novo, verifica se há um nome pré-definido (vindo do Pedido de Compra).
            if (isEditing) {
                setFormData({ ...getInitialState(), ...material });
            } else {
                setFormData({ ...getInitialState(), nome: material?.nome || '' });
            }
        }
    }, [isOpen, material, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const success = await onSave(formData);
        setIsLoading(false);
        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <h3 className="text-xl font-bold mb-4">{isEditing ? 'Editar Material' : 'Novo Material'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ***** NOVO CAMPO ADICIONADO AO FORMULÁRIO ***** */}
                        <div>
                            <label className="block text-sm font-medium">Classificação *</label>
                            <select
                                name="classificacao"
                                value={formData.classificacao || 'Insumo'}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full p-2 border rounded-md bg-gray-50"
                            >
                                <option value="Insumo">Insumo (Consumível)</option>
                                <option value="Equipamento">Equipamento (Retornável)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nome / Título *</label>
                            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Descrição Detalhada</label>
                        <textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Unidade de Medida</label>
                            <input type="text" name="unidade_medida" value={formData.unidade_medida || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: pç, m², kg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Preço Unitário (Referência)</label>
                            <input type="number" step="0.01" name="preco_unitario" value={formData.preco_unitario || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Fornecedor Padrão</label>
                            <select name="empresa_fornecedor_id" value={formData.empresa_fornecedor_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Nenhum</option>
                                {fornecedores?.map(f => ( // Adicionada verificação para evitar erro se fornecedores for undefined
                                    <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                            {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}