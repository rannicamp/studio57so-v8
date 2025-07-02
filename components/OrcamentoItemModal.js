"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faPenToSquare, faTimes } from '@fortawesome/free-solid-svg-icons'; // Adicionado faTimes

// Componente para destacar o texto da busca em amarelo
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

export default function OrcamentoItemModal({ isOpen, onClose, onSave, etapas, itemToEdit }) {
    const supabase = createClient();
    const isEditing = Boolean(itemToEdit?.id);

    const getInitialState = useCallback(() => ({
        id: null, material_id: null, descricao: '', quantidade: 1, unidade: 'unid.', preco_unitario: '', etapa_id: '', categoria: 'Materiais'
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
    }, [isOpen, isEditing, itemToEdit, getInitialState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = async (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        if (field === 'descricao' && value.length < 2) {
            setSearchResults(prev => ({...prev, [field]: []}));
            return;
        } else if (field !== 'descricao' && value.length < 1) {
            setSearchResults(prev => ({...prev, [field]: []}));
            return;
        }

        setIsSearching(true);
        let data, error;

        if (field === 'descricao') {
            ({ data, error } = await supabase
                .from('materiais')
                .select('id, descricao, unidade_medida, preco_unitario, categoria:Grupo')
                .ilike('descricao', `%${value}%`)
                .limit(10));
        } else if (field === 'categoria') {
            ({ data, error } = await supabase
                .from('materiais')
                .select('Grupo')
                .ilike('Grupo', `%${value}%`)
                .limit(5));
        } else if (field === 'unidade') {
            ({ data, error } = await supabase
                .from('materiais')
                .select('unidade_medida')
                .ilike('unidade_medida', `%${value}%`)
                .limit(5));
        } else {
            setIsSearching(false);
            return;
        }

        if (error) { console.error(`Erro na busca de ${field}:`, error); }
        
        let uniqueResults = [];
        if (data) {
            if(field === 'categoria') {
                uniqueResults = [...new Set(data.map(item => item.Grupo).filter(Boolean))];
            } else if(field === 'unidade') {
                uniqueResults = [...new Set(data.map(item => item.unidade_medida).filter(Boolean))];
            } else {
                uniqueResults = data;
            }
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
        const success = await onSave(formData); // Assume onSave retorna true/false ou um objeto com 'success'
        setLoading(false);

        if (success) { // Verifica se a operação de salvar foi bem-sucedida
            setMessage('Item salvo com sucesso!');
            if (!isEditing) { // Se estiver adicionando um novo item
                setFormData(getInitialState()); // Limpa o formulário
                setSearchResults({ descricao: [], categoria: [], unidade: [] }); // Limpa os resultados de busca
                setIsSearching(false);
            } else { // Se estiver editando um item existente
                onClose(); // Fecha o modal após a edição
            }
        } else {
            setMessage('Erro ao salvar o item.'); // Mensagem de erro genérica se onSave falhar
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{isEditing ? 'Editar Item do Orçamento' : 'Adicionar Novo Item'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
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
                            {isSearching && <p className="text-xs text-gray-500">Buscando categorias...</p>}
                            {searchResults.categoria && searchResults.categoria.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                    {searchResults.categoria.map(cat => (
                                        <li key={cat} onClick={() => handleSelect('categoria', cat)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">
                                            <HighlightedText text={cat} highlight={formData.categoria} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium">Unidade</label>
                            <input type="text" name="unidade" value={formData.unidade || ''} onChange={(e) => handleSearchChange('unidade', e.target.value)} className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                            {isSearching && <p className="text-xs text-gray-500">Buscando unidades...</p>}
                            {searchResults.unidade && searchResults.unidade.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                    {searchResults.unidade.map(un => (
                                        <li key={un} onClick={() => handleSelect('unidade', un)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">
                                            <HighlightedText text={un} highlight={formData.unidade} />
                                        </li>
                                    ))}
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