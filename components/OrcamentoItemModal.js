"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus } from '@fortawesome/free-solid-svg-icons';

export default function OrcamentoItemModal({ isOpen, onClose, onSave, orcamentoId, itemToEdit }) {
    const supabase = createClient();
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const isEditing = Boolean(itemToEdit);

    useEffect(() => {
        if (isOpen) {
            setFormData(itemToEdit || { categoria: 'Materiais', unidade: 'unid.', quantidade: 1 });
            setSearchTerm(itemToEdit?.descricao || '');
            setSearchResults([]);
            setMessage('');
        }
    }, [isOpen, itemToEdit]);

    const handleSearchChange = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length < 3) { setSearchResults([]); return; }
        setIsSearching(true);
        const { data } = await supabase.from('materiais').select('id, descricao, unidade_medida, preco_unitario, categoria:Grupo').ilike('descricao', `%${value}%`).limit(5);
        setSearchResults(data || []);
        setIsSearching(false);
    };

    const handleSelectMaterial = (material) => {
        setFormData(prev => ({ ...prev, ...material, material_id: material.id }));
        setSearchTerm(material.descricao);
        setSearchResults([]);
    };
    
    const handleAddNewMaterial = () => {
        setFormData(prev => ({ ...prev, descricao: searchTerm, material_id: null })); // Indica que é um novo item
        setSearchResults([]);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.descricao && !searchTerm) {
            setMessage('A descrição do item é obrigatória.');
            return;
        }
        setLoading(true);
        // Garante que a descrição seja a do termo de busca se um item não foi selecionado
        const dataToSave = { ...formData };
        if (!dataToSave.descricao) {
            dataToSave.descricao = searchTerm;
        }

        await onSave(dataToSave);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <h3 className="text-xl font-bold mb-4">{isEditing ? 'Editar Item' : 'Adicionar Novo Item'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Descrição do Item/Serviço *</label>
                        <input type="text" name="descricao" value={searchTerm} onChange={handleSearchChange} required className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                        {isSearching && <p className="text-xs text-gray-500">Buscando materiais...</p>}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {searchResults.map(material => (<li key={material.id} onClick={() => handleSelectMaterial(material)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">{material.descricao}</li>))}
                            </ul>
                        )}
                        {searchTerm && !isSearching && searchResults.length === 0 && (
                             <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg p-3">
                                <button type="button" onClick={handleAddNewMaterial} className="text-blue-600 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faPlus} /> Usar o texto "{searchTerm}"</button>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Categoria</label><input type="text" name="categoria" value={formData.categoria || 'Outros'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Unidade</label><input type="text" name="unidade" value={formData.unidade || 'unid.'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Quantidade</label><input type="number" name="quantidade" min="0" step="0.01" value={formData.quantidade || 1} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Preço Unitário</label><input type="number" name="preco_unitario" min="0" step="0.01" value={formData.preco_unitario || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Adicionar Item')}</button>
                    </div>
                    {message && <p className="text-red-500 text-sm text-center">{message}</p>}
                </form>
            </div>
        </div>
    );
}