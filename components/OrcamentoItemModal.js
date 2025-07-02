"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus } from '@fortawesome/free-solid-svg-icons';

// Componente para destacar o texto da busca em amarelo (sem alteração)
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight || !text) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 px-0 py-0 rounded">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

export default function OrcamentoItemModal({ isOpen, onClose, onSave, orcamentoId, itemToEdit, etapas }) {
    const supabase = createClient();
    const isEditing = Boolean(itemToEdit?.id);

    const getInitialState = useCallback(() => ({
        descricao: '', categoria: 'Materiais', unidade: 'unid.', quantidade: 1, preco_unitario: '', etapa_id: '', material_id: null
    }), []);

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [searchResults, setSearchResults] = useState({ descricao: [], categoria: [], unidade: [] });
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initialData = isEditing ? { ...itemToEdit, categoria: itemToEdit.categoria || 'Materiais', unidade: itemToEdit.unidade || 'unid.' } : getInitialState();
            setFormData(initialData);
            setSearchResults({ descricao: [], categoria: [], unidade: [] });
            setMessage('');
        }
    }, [isOpen, itemToEdit, isEditing, getInitialState]);

    const handleSearchChange = async (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (value.length < 1) {
            setSearchResults(prev => ({...prev, [field]: []}));
            return;
        }

        let query;
        if (field === 'descricao') {
            query = supabase.rpc('buscar_materiais', { search_term: value });
        } else if (field === 'categoria') {
            query = supabase.from('materiais').select('Grupo').ilike('Grupo', `%${value}%`).limit(5);
        } else if (field === 'unidade') {
            query = supabase.from('materiais').select('unidade_medida').ilike('unidade_medida', `%${value}%`).limit(5);
        } else {
            return;
        }

        setIsSearching(true);
        const { data, error } = await query;
        if (error) { console.error(`Erro na busca de ${field}:`, error); }
        
        let uniqueResults = [];
        if (data) {
            if(field === 'categoria') uniqueResults = [...new Map(data.map(item => [item.Grupo, item])).values()].map(item => item.Grupo).filter(Boolean);
            else if(field === 'unidade') uniqueResults = [...new Map(data.map(item => [item.unidade_medida, item])).values()].map(item => item.unidade_medida).filter(Boolean);
            else uniqueResults = data;
        }
        
        setSearchResults(prev => ({...prev, [field]: uniqueResults || []}));
        setIsSearching(false);
    };

    const handleSelect = (field, value) => {
        if (field === 'material') {
            setFormData(prev => ({
                ...prev,
                descricao: value.descricao,
                unidade: value.unidade_medida || 'unid.',
                preco_unitario: value.preco_unitario || '',
                categoria: value.categoria || 'Materiais',
                material_id: value.id,
            }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
        setSearchResults({ descricao: [], categoria: [], unidade: [] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.descricao) {
            setMessage('A descrição do item é obrigatória.');
            return;
        }
        setLoading(true);
        await onSave(formData);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <h3 className="text-xl font-bold mb-4">{isEditing ? 'Editar Item do Orçamento' : 'Adicionar Novo Item'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Descrição do Item/Serviço *</label>
                        <input type="text" name="descricao" value={formData.descricao || ''} onChange={(e) => handleSearchChange('descricao', e.target.value)} required className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                        {isSearching && <p className="text-xs text-gray-500">Buscando materiais...</p>}
                        {searchResults.descricao && searchResults.descricao.length > 0 && (
                            <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {searchResults.descricao.map(material => (<li key={material.id} onClick={() => handleSelect('material', material)} className="p-2 border-b hover:bg-gray-100 cursor-pointer"><HighlightedText text={material.descricao} highlight={formData.descricao} /></li>))}
                            </ul>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-sm font-medium">Categoria</label>
                            <input type="text" name="categoria" value={formData.categoria || ''} onChange={(e) => handleSearchChange('categoria', e.target.value)} className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                            {searchResults.categoria && searchResults.categoria.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                    {searchResults.categoria.map(cat => (<li key={cat} onClick={() => handleSelect('categoria', cat)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">{cat}</li>))}
                                </ul>
                            )}
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium">Unidade</label>
                            <input type="text" name="unidade" value={formData.unidade || ''} onChange={(e) => handleSearchChange('unidade', e.target.value)} className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                            {searchResults.unidade && searchResults.unidade.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                    {searchResults.unidade.map(un => (<li key={un} onClick={() => handleSelect('unidade', un)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">{un}</li>))}
                                </ul>
                            )}
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Etapa da Obra</label>
                        <select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhuma</option>{etapas.map(etapa => (<option key={etapa.id} value={etapa.id}>{etapa.nome_etapa}</option>))}</select>
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