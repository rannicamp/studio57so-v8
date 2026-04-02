// components/financeiro/CategoriaFormModal.js
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faChevronDown } from '@fortawesome/free-solid-svg-icons';

// Componente para destaque na pesquisa
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

export default function CategoriaFormModal({ isOpen, onClose, onSave, initialData, allCategories = [], defaultType = 'Despesa' }) {
    // Agora verifica ID para confirmar edição
    const isEditing = Boolean(initialData?.id);

    const getInitialState = useCallback(() => ({
        nome: '',
        tipo: defaultType,
        parent_id: null,
    }), [defaultType]);

    const [formData, setFormData] = useState(getInitialState);
    const [loading, setLoading] = useState(false);

    // Estados para o Searchable Dropdown de Categoria Pai
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchParent, setSearchParent] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? initialData : getInitialState());
            setSearchParent('');
            setIsDropdownOpen(false);
        }
    }, [isOpen, initialData, isEditing, getInitialState]);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const nextState = { ...prev, [name]: value === '' ? null : value };
            // Se mudar o tipo, limpa o parent_id pois categorias não podem se cruzar
            if (name === 'tipo' && value !== prev.tipo) {
                nextState.parent_id = null;
            }
            return nextState;
        });
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

    // Filtra possíveis categorias pais (mesmo tipo, não é ele mesmo)
    const availableParents = allCategories.filter(c => 
        c.tipo === formData.tipo && (!isEditing || c.id !== formData.id)
    );

    // Filtra pela busca
    const filteredParents = availableParents.filter(c => 
        (c.nome || '').toLowerCase().includes(searchParent.toLowerCase())
    );

    // Pega o nome da categoria pai selecionada
    const selectedParentName = availableParents.find(c => String(c.id) === String(formData.parent_id))?.nome || 'Nenhuma (Categoria Principal)';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
                    <h3 className="text-2xl font-bold text-gray-800">{isEditing ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                    <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-visible">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Nome da Categoria *</label>
                            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Tipo *</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100" disabled={isEditing}>
                                <option>Despesa</option>
                                <option>Receita</option>
                            </select>
                            {isEditing && <p className="text-xs text-gray-500 mt-1">O tipo não pode ser alterado após a criação.</p>}
                        </div>

                        {/* Searchable Parent Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-sm font-medium">Subcategoria de (Opcional)</label>
                            
                            <div 
                                className="mt-1 w-full p-2 border rounded-md bg-white cursor-pointer flex justify-between items-center"
                                onClick={() => { setIsDropdownOpen(!isDropdownOpen); setSearchParent(''); }}
                            >
                                <span className={formData.parent_id ? 'text-gray-900' : 'text-gray-500'}>
                                    {selectedParentName}
                                </span>
                                <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-60 flex flex-col opacity-100 scale-100 transition-all origin-top-left">
                                    <div className="p-2 border-b bg-gray-50">
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
                                            </div>
                                            <input 
                                                type="text" 
                                                autoFocus
                                                value={searchParent}
                                                onChange={(e) => setSearchParent(e.target.value)}
                                                placeholder="Buscar categoria..."
                                                className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    
                                    <ul className="overflow-y-auto flex-1 py-1">
                                        <li 
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-50 ${!formData.parent_id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, parent_id: null }));
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            Nenhuma (Categoria Principal)
                                        </li>
                                        {filteredParents.length === 0 ? (
                                            <li className="px-3 py-4 text-sm text-gray-500 text-center italic">
                                                Nenhuma categoria encontrada
                                            </li>
                                        ) : (
                                            filteredParents.map(cat => (
                                                <li 
                                                    key={cat.id} 
                                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${String(formData.parent_id) === String(cat.id) ? 'bg-blue-50/50 font-semibold text-blue-700' : 'text-gray-700'}`}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, parent_id: cat.id }));
                                                        setIsDropdownOpen(false);
                                                    }}
                                                >
                                                    <HighlightedText text={cat.nome} highlight={searchParent} />
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-semibold">Cancelar</button>
                            <button type="button" onClick={handleSubmit} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-semibold disabled:bg-gray-400 flex items-center gap-2">
                                {loading ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : 'Salvar Categoria'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}