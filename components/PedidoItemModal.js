'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function PedidoItemModal({ isOpen, onClose, onSave, etapas }) {
    if (!isOpen) return null;

    const supabase = createClient();
    const [newItem, setNewItem] = useState({
        descricao_item: '',
        quantidade_solicitada: 1,
        unidade_medida: 'unid.',
        etapa_id: '',
        fornecedor_id: null,
        fornecedor_nome: '', // Campo auxiliar para o input de busca
        preco_unitario_real: ''
    });

    const [materialSearchResults, setMaterialSearchResults] = useState([]);
    const [fornecedorSearchResults, setFornecedorSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState({ material: false, fornecedor: false });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleInputChange = async (e) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));

        // Busca de Materiais
        if (name === 'descricao_item') {
            if (value.length < 3) { setMaterialSearchResults([]); return; }
            setIsSearching(prev => ({ ...prev, material: true }));
            const { data } = await supabase.from('materiais').select('id, descricao, unidade_medida').ilike('descricao', `%${value}%`).limit(5);
            setMaterialSearchResults(data || []);
            setIsSearching(prev => ({ ...prev, material: false }));
        }

        // Busca de Fornecedores
        if (name === 'fornecedor_nome') {
            if (value.length < 3) { setFornecedorSearchResults([]); return; }
            setIsSearching(prev => ({ ...prev, fornecedor: true }));
            const { data } = await supabase.from('contatos').select('id, nome').eq('tipo_contato', 'Fornecedor').ilike('nome', `%${value}%`).limit(5);
            setFornecedorSearchResults(data || []);
            setIsSearching(prev => ({ ...prev, fornecedor: false }));
        }
    };

    const handleSelectMaterial = (material) => {
        setNewItem(prev => ({
            ...prev,
            material_id: material.id,
            descricao_item: material.descricao,
            unidade_medida: material.unidade_medida || 'unid.'
        }));
        setMaterialSearchResults([]);
    };

    const handleSelectFornecedor = (fornecedor) => {
        setNewItem(prev => ({
            ...prev,
            fornecedor_id: fornecedor.id,
            fornecedor_nome: fornecedor.nome,
        }));
        setFornecedorSearchResults([]);
    };

    const handleSaveClick = async () => {
        if (!newItem.descricao_item || !newItem.quantidade_solicitada || !newItem.etapa_id) {
            setMessage('Preencha a Descrição, Quantidade e Etapa para adicionar.');
            return;
        }
        setIsSaving(true);
        setMessage('');
        // Remove o campo auxiliar antes de salvar
        const { fornecedor_nome, ...itemToSave } = newItem;
        await onSave(itemToSave);
        setIsSaving(false);
        setNewItem({ descricao_item: '', quantidade_solicitada: 1, unidade_medida: 'unid.', etapa_id: '', fornecedor_id: null, fornecedor_nome: '', preco_unitario_real: '' });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                <h3 className="text-xl font-bold mb-4">Adicionar Item ao Pedido</h3>
                {message && <p className="text-sm text-red-500 mb-4">{message}</p>}
                
                <div className="space-y-4">
                    {/* BUSCA DE MATERIAL */}
                    <div className="relative">
                        <label className="block text-sm font-medium">Buscar Material *</label>
                        <input type="text" name="descricao_item" value={newItem.descricao_item} onChange={handleInputChange} placeholder="Digite para buscar..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                        {isSearching.material && <p className="text-xs text-gray-500">Buscando...</p>}
                        {materialSearchResults.length > 0 && (
                             <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {materialSearchResults.map(material => <li key={material.id} onClick={() => handleSelectMaterial(material)} className="p-2 hover:bg-gray-100 cursor-pointer">{material.descricao}</li>)}
                            </ul>
                        )}
                    </div>

                    {/* BUSCA DE FORNECEDOR */}
                    <div className="relative">
                        <label className="block text-sm font-medium">Fornecedor</label>
                        <input type="text" name="fornecedor_nome" value={newItem.fornecedor_nome} onChange={handleInputChange} placeholder="Digite para buscar um fornecedor..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                         {isSearching.fornecedor && <p className="text-xs text-gray-500">Buscando...</p>}
                        {fornecedorSearchResults.length > 0 && (
                             <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {fornecedorSearchResults.map(f => <li key={f.id} onClick={() => handleSelectFornecedor(f)} className="p-2 hover:bg-gray-100 cursor-pointer">{f.nome}</li>)}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Quantidade *</label>
                            <input type="number" name="quantidade_solicitada" value={newItem.quantidade_solicitada} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Unidade</label>
                            <input type="text" name="unidade_medida" value={newItem.unidade_medida} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Preço Unitário</label>
                            <input type="number" step="0.01" name="preco_unitario_real" value={newItem.preco_unitario_real} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Etapa da Obra *</label>
                        <select name="etapa_id" value={newItem.etapa_id} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione a etapa</option>
                            {etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSaveClick} disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Item'}
                    </button>
                </div>
            </div>
        </div>
    );
}