'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client'; // LINHA CORRIGIDA AQUI
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faPenToSquare, faTimes } from '@fortawesome/free-solid-svg-icons';

// Componente para destacar o texto da busca em amarelo
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight || !text || !highlight.trim()) {
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
        preco_unitario_real: '',
        // NOVOS CAMPOS:
        tipo_operacao: 'Compra', // Valor padrão 'Compra'
        dias_aluguel: null // Valor inicial nulo
    }), []);

    const [item, setItem] = useState(getInitialState());
    const [isItemSelected, setIsItemSelected] = useState(false);
    const [materialSearchResults, setMaterialSearchResults] = useState([]);
    const [fornecedorSearchResults, setFornecedorSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState({ material: false, fornecedor: false });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [fornecedorSearchTerm, setFornecedorSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                const initialFornecedorName = itemToEdit.fornecedor?.razao_social || itemToEdit.fornecedor?.nome || '';
                setItem({
                    id: itemToEdit.id,
                    material_id: itemToEdit.material_id,
                    descricao_item: itemToEdit.descricao_item || '',
                    quantidade_solicitada: itemToEdit.quantidade_solicitada || 1,
                    unidade_medida: itemToEdit.unidade_medida || 'unid.',
                    etapa_id: itemToEdit.etapa_id || '',
                    fornecedor_id: itemToEdit.fornecedor_id,
                    fornecedor_nome: initialFornecedorName,
                    preco_unitario_real: itemToEdit.preco_unitario_real || '',
                    // POPULAR NOVOS CAMPOS AO EDITAR
                    tipo_operacao: itemToEdit.tipo_operacao || 'Compra',
                    dias_aluguel: itemToEdit.dias_aluguel || null
                });
                setIsItemSelected(!!itemToEdit.material_id || !!itemToEdit.descricao_item);
                setSearchTerm(itemToEdit.descricao_item || '');
                setFornecedorSearchTerm(initialFornecedorName);
            } else {
                setItem(getInitialState()); // Resetar para o estado inicial
                setSearchTerm('');
                setFornecedorSearchTerm('');
                setIsItemSelected(false);
            }
             setMaterialSearchResults([]);
             setFornecedorSearchResults([]);
            setMessage('');
        }
    }, [isOpen, isEditing, itemToEdit, getInitialState]);
    
    const handleMaterialSearchChange = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length < 2) { setMaterialSearchResults([]); return; }
        setIsSearching(prev => ({ ...prev, material: true }));
        const { data, error } = await supabase.from('materiais').select('id, descricao, unidade_medida, preco_unitario, categoria:Grupo').ilike('descricao', `%${value}%`).limit(10);
        if (error) console.error("Erro na busca de materiais:", error);
        setMaterialSearchResults(data || []);
        setIsSearching(prev => ({ ...prev, material: false }));
    };
    
    const handleFornecedorSearchChange = async (e) => {
        const value = e.target.value;
        setFornecedorSearchTerm(value);
        if (value.length < 2) { setFornecedorSearchResults([]); return; }
        
        setIsSearching(prev => ({ ...prev, fornecedor: true }));
        
        const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, razao_social, nome_fantasia')
            .or(`nome.ilike.%${value}%,razao_social.ilike.%${value}%,nome_fantasia.ilike.%${value}%`)
            .limit(10);

        if (error) {
            console.error("Erro na busca de fornecedores:", error);
            setFornecedorSearchResults([]);
        } else {
            setFornecedorSearchResults(data || []);
        }
        
        setIsSearching(prev => ({ ...prev, fornecedor: false }));
    };

    const handleSelectMaterial = (material) => {
        setItem(prev => ({ ...prev, material_id: material.id, descricao_item: material.descricao, unidade_medida: material.unidade_medida || 'unid.' }));
        setIsItemSelected(true);
        setMaterialSearchResults([]);
        setSearchTerm(material.descricao);
    };

    const handleAddNewMaterialText = () => {
        setItem(prev => ({ ...prev, material_id: null, descricao_item: searchTerm }));
        setIsItemSelected(true);
        setMaterialSearchResults([]);
    }

    const handleResetItemSelection = () => {
        setIsItemSelected(false);
        setItem(prev => ({...prev, material_id: null, descricao_item: ''}));
        setSearchTerm('');
    }

    const handleSelectFornecedor = (fornecedor) => {
        setItem(prev => ({ ...prev, fornecedor_id: fornecedor.id }));
        setFornecedorSearchTerm(fornecedor.razao_social || fornecedor.nome);
        setFornecedorSearchResults([]);
    };

    // NOVA FUNÇÃO para lidar com as mudanças nos campos do item
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setItem(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleSaveClick = async () => {
        if (!item.descricao_item && !searchTerm) { setMessage('A descrição do item é obrigatória.'); return; }
        
        // Validação específica para aluguel
        if (item.tipo_operacao === 'Aluguel' && (!item.dias_aluguel || item.dias_aluguel <= 0)) {
            setMessage('Para aluguel, a quantidade de dias é obrigatória e deve ser maior que zero.');
            return;
        }

        setIsSaving(true);
        setMessage('');
        
        const itemToSave = { ...item };
        if (!isItemSelected && searchTerm) {
            itemToSave.descricao_item = searchTerm;
        }

        // Limpar dias_aluguel se não for Aluguel
        if (itemToSave.tipo_operacao !== 'Aluguel') {
            itemToSave.dias_aluguel = null;
        }

        // Remover fornecedor_nome do objeto a ser salvo, pois não é uma coluna da tabela
        delete itemToSave.fornecedor_nome;
        
        const result = await onSave(itemToSave);
        setIsSaving(false);
        if (result.success) { onClose(); } 
        else { setMessage(result.error || 'Ocorreu um erro desconhecido.'); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold">{isEditing ? 'Editar Item do Pedido' : 'Adicionar Item ao Pedido'}</h3>
                     <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                {message && <p className="text-sm text-red-500 mb-4">{message}</p>}
                <div className="space-y-4">
                     <div className="relative">
                        <label className="block text-sm font-medium">Material / Descrição do Item</label>
                        {isItemSelected ? (
                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                                <span className="font-semibold text-gray-800">{item.descricao_item}</span>
                                <button onClick={handleResetItemSelection} className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1"> <FontAwesomeIcon icon={faPenToSquare} /> Alterar </button>
                            </div>
                        ) : (
                            <>
                                <input type="text" value={searchTerm} onChange={handleMaterialSearchChange} placeholder="Digite para buscar ou descrever..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                                {isSearching.material && <p className="text-xs text-gray-500">Buscando...</p>}
                                {materialSearchResults.length > 0 && (
                                     <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {materialSearchResults.map(material => 
                                            <li key={material.id} onClick={() => handleSelectMaterial(material)} className="p-3 hover:bg-gray-100 cursor-pointer">
                                                <HighlightedText text={material.descricao} highlight={searchTerm} />
                                            </li>
                                        )}
                                    </ul>
                                )}
                                {!isSearching.material && searchTerm.length > 2 && materialSearchResults.length === 0 && (
                                     <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg p-3">
                                        <button type="button" onClick={handleAddNewMaterialText} className="text-blue-600 font-semibold flex items-center gap-2"> <FontAwesomeIcon icon={faPlus} /> Usar o texto &quot;{searchTerm}&quot; </button>
                                     </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="relative mt-2">
                        <label className="block text-sm font-medium">Fornecedor</label>
                        <input type="text" value={fornecedorSearchTerm} onChange={handleFornecedorSearchChange} placeholder="Buscar por Nome, Razão Social ou Fantasia..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                        {isSearching.fornecedor && <p className="text-xs text-gray-500">Buscando...</p>}
                        {fornecedorSearchResults.length > 0 && (
                            <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {fornecedorSearchResults.map(f => <li key={f.id} onClick={() => handleSelectFornecedor(f)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={f.razao_social || f.nome} highlight={fornecedorSearchTerm} /> <span className="text-xs text-gray-500">{f.nome_fantasia && `(${f.nome_fantasia})`}</span></li>)}
                            </ul>
                        )}
                    </div>

                    {/* NOVO CAMPO: Tipo de Operação (Compra/Aluguel) */}
                    <div>
                        <label className="block text-sm font-medium">Tipo de Operação</label>
                        <select
                            name="tipo_operacao"
                            value={item.tipo_operacao}
                            onChange={handleChange}
                            className="mt-1 w-full p-2 border rounded-md"
                        >
                            <option value="Compra">Compra</option>
                            <option value="Aluguel">Aluguel</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div> <label className="block text-sm font-medium">Quantidade</label> <input type="number" name="quantidade_solicitada" value={item.quantidade_solicitada} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                        <div> <label className="block text-sm font-medium">Unidade</label> <input type="text" name="unidade_medida" value={item.unidade_medida} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                        <div> <label className="block text-sm font-medium">Preço Unitário</label> <input type="number" step="0.01" name="preco_unitario_real" value={item.preco_unitario_real || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                    </div>
                    
                    {/* NOVO CAMPO: Dias de Aluguel (condicional) */}
                    {item.tipo_operacao === 'Aluguel' && (
                        <div>
                            <label className="block text-sm font-medium">Dias de Aluguel</label>
                            <input
                                type="number"
                                name="dias_aluguel"
                                value={item.dias_aluguel || ''}
                                onChange={handleChange}
                                min="1"
                                className="mt-1 w-full p-2 border rounded-md"
                                required // Tornar obrigatório se for aluguel
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium">Etapa da Obra</label>
                        <select name="etapa_id" value={item.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"> <option value="">Selecione a etapa</option> {etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)} </select>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSaveClick} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={isSaving}> {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Item'} </button>
                </div>
            </div>
        </div>
    );
}