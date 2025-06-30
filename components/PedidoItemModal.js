'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons';

// INÍCIO DA ALTERAÇÃO: Adicionada a prop 'itemToEdit'
export default function PedidoItemModal({ isOpen, onClose, onSave, etapas, itemToEdit }) {
    const supabase = createClient();
    const isEditing = Boolean(itemToEdit);

    const getInitialState = useCallback(() => ({
        id: null,
        material_id: null,
        descricao_item: '',
        quantidade_solicitada: 1,
        unidade_medida: 'unid.',
        etapa_id: '',
        fornecedor_id: null,
        fornecedor_nome: '',
        preco_unitario_real: ''
    }), []);

    const [item, setItem] = useState(getInitialState());
    const [isItemSelected, setIsItemSelected] = useState(false);
    // FIM DA ALTERAÇÃO

    const [fornecedorSearchResults, setFornecedorSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState({ material: false, fornecedor: false });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            // INÍCIO DA ALTERAÇÃO: Lógica para carregar dados do item em edição
            if (isEditing) {
                setItem({
                    id: itemToEdit.id,
                    material_id: itemToEdit.material_id,
                    descricao_item: itemToEdit.descricao_item || '',
                    quantidade_solicitada: itemToEdit.quantidade_solicitada || 1,
                    unidade_medida: itemToEdit.unidade_medida || 'unid.',
                    etapa_id: itemToEdit.etapa_id || '',
                    fornecedor_id: itemToEdit.fornecedor_id,
                    fornecedor_nome: itemToEdit.fornecedor?.nome || '', // Pega o nome do fornecedor aninhado
                    preco_unitario_real: itemToEdit.preco_unitario_real || ''
                });
                setIsItemSelected(true); // Se estamos editando, o item já foi "selecionado"
                setSearchTerm(itemToEdit.descricao_item);
            } else {
                setItem(getInitialState());
                setSearchTerm('');
                setIsItemSelected(false);
            }
            // FIM DA ALTERAÇÃO
            
            setFornecedorSearchResults([]);
            setMessage('');
        }
    }, [isOpen, isEditing, itemToEdit, getInitialState]);

    const handleSearchChange = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (value.length < 3) {
            setFornecedorSearchResults([]);
            return;
        }

        setIsSearching(prev => ({ ...prev, material: true }));
        const { data } = await supabase.from('materiais').select('id, descricao, unidade_medida').ilike('descricao', `%${value}%`).limit(5);
        setFornecedorSearchResults(data || []);
        setIsSearching(prev => ({ ...prev, material: false }));
    };

    const handleSelectMaterial = (material) => {
        setItem(prev => ({
            ...prev,
            material_id: material.id,
            descricao_item: material.descricao,
            unidade_medida: material.unidade_medida || 'unid.'
        }));
        setIsItemSelected(true);
        setFornecedorSearchResults([]);
        setSearchTerm(material.descricao);
    };

    const handleAddNewMaterialText = () => {
        setItem(prev => ({
            ...prev,
            material_id: null,
            descricao_item: searchTerm
        }));
        setIsItemSelected(true);
        setFornecedorSearchResults([]);
    }

    const handleResetItemSelection = () => {
        setIsItemSelected(false);
        setItem(prev => ({...prev, material_id: null, descricao_item: ''}));
        setSearchTerm('');
    }

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') e.preventDefault();
        if (e.key === 'Escape') setFornecedorSearchResults([]);
    }

    const handleSearchBlur = () => {
        setTimeout(() => setFornecedorSearchResults([]), 150);
    }

    const handleInputChange = async (e) => {
        const { name, value } = e.target;
        setItem(prev => ({ ...prev, [name]: value }));

        if (name === 'fornecedor_nome') {
            if (value.length < 3) { setFornecedorSearchResults([]); return; }
            setIsSearching(prev => ({ ...prev, fornecedor: true }));
            const { data } = await supabase.from('contatos').select('id, nome').eq('tipo_contato', 'Fornecedor').ilike('nome', `%${value}%`).limit(5);
            setFornecedorSearchResults(data || []);
            setIsSearching(prev => ({ ...prev, fornecedor: false }));
        }
    };

    const handleSelectFornecedor = (fornecedor) => {
        setItem(prev => ({ ...prev, fornecedor_id: fornecedor.id, fornecedor_nome: fornecedor.nome }));
        setFornecedorSearchResults([]);
    };

    const handleSaveClick = async () => {
        if (!item.descricao_item) {
            setMessage('A descrição do item é obrigatória.');
            return;
        }
        setIsSaving(true);
        setMessage('');

        const { fornecedor_nome, ...itemData } = item;
        const itemToSave = {
            ...itemData,
            etapa_id: itemData.etapa_id || null
        };

        const result = await onSave(itemToSave);
        setIsSaving(false);

        if (result.success) {
            onClose();
        } else {
            setMessage(result.error || 'Ocorreu um erro desconhecido.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                <h3 className="text-xl font-bold mb-4">{isEditing ? 'Editar Item do Pedido' : 'Adicionar Item ao Pedido'}</h3>
                {message && <p className="text-sm text-red-500 mb-4">{message}</p>}

                <div className="space-y-4">
                     <div className="relative">
                        <label className="block text-sm font-medium">Material / Descrição do Item *</label>

                        {isItemSelected ? (
                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                                <span className="font-semibold text-gray-800">{item.descricao_item}</span>
                                <button onClick={handleResetItemSelection} className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1">
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                    Alterar
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyDown={handleSearchKeyDown}
                                    onBlur={handleSearchBlur}
                                    placeholder="Digite para buscar ou descrever..."
                                    className="mt-1 w-full p-2 border rounded-md"
                                    autoComplete="off"
                                />
                                {isSearching.material && <p className="text-xs text-gray-500 absolute -bottom-5">Buscando...</p>}
                                {(fornecedorSearchResults.length > 0 || searchTerm.length > 2) && !isSearching.material && (
                                     <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {fornecedorSearchResults.map(material => <li key={material.id} onClick={() => handleSelectMaterial(material)} className="p-3 hover:bg-gray-100 cursor-pointer">{material.descricao}</li>)}
                                        {fornecedorSearchResults.length === 0 && searchTerm.length > 2 && (
                                             <li onClick={handleAddNewMaterialText} className="p-3 hover:bg-blue-50 cursor-pointer text-blue-600 font-semibold flex items-center gap-2">
                                                 <FontAwesomeIcon icon={faPlus} /> Adicionar &quot;{searchTerm}&quot; como novo item
                                             </li>
                                        )}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>

                    <div className="relative mt-2">
                        <label className="block text-sm font-medium">Fornecedor</label>
                        <input type="text" name="fornecedor_nome" value={item.fornecedor_nome} onChange={handleInputChange} placeholder="Digite para buscar um fornecedor..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                         {isSearching.fornecedor && <p className="text-xs text-gray-500">Buscando...</p>}
                        {fornecedorSearchResults.length > 0 && (
                             <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {fornecedorSearchResults.map(f => <li key={f.id} onClick={() => handleSelectFornecedor(f)} className="p-2 hover:bg-gray-100 cursor-pointer">{f.nome}</li>)}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Quantidade</label>
                            <input type="number" name="quantidade_solicitada" value={item.quantidade_solicitada} onChange={(e) => setItem({...item, quantidade_solicitada: e.target.value})} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Unidade</label>
                            <input type="text" name="unidade_medida" value={item.unidade_medida} onChange={(e) => setItem({...item, unidade_medida: e.target.value})} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Preço Unitário</label>
                            <input type="number" step="0.01" name="preco_unitario_real" value={item.preco_unitario_real} onChange={(e) => setItem({...item, preco_unitario_real: e.target.value})} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Etapa da Obra</label>
                        <select name="etapa_id" value={item.etapa_id} onChange={(e) => setItem({...item, etapa_id: e.target.value})} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione a etapa</option>
                            {etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSaveClick} disabled={isSaving || !isItemSelected} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Salvar Item')}
                    </button>
                </div>
            </div>
        </div>
    );
}