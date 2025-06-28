"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function OrcamentoItemModal({ isOpen, onClose, onSave, orcamentoId, itemToEdit }) {
    const supabase = createClient();
    const [formData, setFormData] = useState({
        descricao: '',
        categoria: 'Materiais',
        unidade: 'unid.',
        quantidade: 1,
        preco_unitario: '',
        etapa_id: '', // Campo novo para a etapa
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [etapas, setEtapas] = useState([]); // Estado para armazenar as etapas da obra

    // Efeito para buscar as etapas da obra quando o modal abrir
    useEffect(() => {
        const fetchEtapas = async () => {
            const { data, error } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
            if (error) {
                console.error("Erro ao buscar etapas:", error);
            } else {
                setEtapas(data || []);
            }
        };

        if (isOpen) {
            fetchEtapas();
        }
    }, [isOpen, supabase]);
    
    useEffect(() => {
        if (itemToEdit) {
            setFormData({
                descricao: itemToEdit.descricao || '',
                categoria: itemToEdit.categoria || 'Materiais',
                unidade: itemToEdit.unidade || 'unid.',
                quantidade: itemToEdit.quantidade || 1,
                preco_unitario: itemToEdit.preco_unitario || '',
                etapa_id: itemToEdit.etapa_id || '', // Carrega a etapa se estiver editando
            });
        } else {
            setFormData({
                descricao: '',
                categoria: 'Materiais',
                unidade: 'unid.',
                quantidade: 1,
                preco_unitario: '',
                etapa_id: '', // Limpa o campo ao adicionar novo item
            });
        }
    }, [itemToEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'descricao' && value.length > 2) {
            setIsSearching(true);
            const timer = setTimeout(async () => {
                const { data } = await supabase
                    .from('materiais')
                    .select('id, descricao, unidade_medida, preco_unitario, categoria:Grupo')
                    .ilike('descricao', `%${value}%`)
                    .limit(5);
                setSearchResults(data || []);
                setIsSearching(false);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    };

    const handleSelectMaterial = (material) => {
        setFormData(prev => ({
            ...prev,
            descricao: material.descricao,
            unidade: material.unidade_medida || 'unid.',
            preco_unitario: material.preco_unitario || '',
            categoria: material.categoria || 'Materiais' 
        }));
        setSearchResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const dataToSave = {
            ...formData,
            orcamento_id: orcamentoId,
            etapa_id: formData.etapa_id || null, // Garante que será salvo como nulo se vazio
            preco_unitario: formData.preco_unitario || null,
            status_cotacao: formData.preco_unitario ? 'Cotado' : 'Pendente de Cotação'
        };

        let error;
        if (itemToEdit) {
            const { error: updateError } = await supabase
                .from('orcamento_itens')
                .update(dataToSave)
                .eq('id', itemToEdit.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('orcamento_itens')
                .insert(dataToSave);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro ao salvar: ${error.message}`);
            console.error(error);
        } else {
            onSave();
            onClose();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <h3 className="text-xl font-bold mb-4">{itemToEdit ? 'Editar Item' : 'Adicionar Novo Item'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Descrição do Item/Serviço</label>
                        <input
                            type="text"
                            name="descricao"
                            value={formData.descricao}
                            onChange={handleChange}
                            required
                            className="mt-1 w-full p-2 border rounded-md"
                            autoComplete="off"
                        />
                        {isSearching && <p className="text-xs text-gray-500">Buscando materiais...</p>}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {searchResults.map(material => (
                                    <li
                                        key={material.id}
                                        onClick={() => handleSelectMaterial(material)}
                                        className="p-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 cursor-pointer"
                                    >
                                        {material.descricao}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {/* Linha com os novos campos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium">Etapa da Obra</label>
                            <select
                                name="etapa_id"
                                value={formData.etapa_id}
                                onChange={handleChange}
                                className="mt-1 w-full p-2 border rounded-md"
                            >
                                <option value="">Nenhuma</option>
                                {etapas.map(etapa => (
                                    <option key={etapa.id} value={etapa.id}>{etapa.nome_etapa}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Categoria</label>
                            <input type="text" name="categoria" value={formData.categoria} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                    {/* Campos restantes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Unidade</label>
                            <input type="text" name="unidade" value={formData.unidade} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Quantidade</label>
                            <input type="number" name="quantidade" min="0" step="0.01" value={formData.quantidade} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Preço Unitário (Deixe em branco se pendente de cotação)</label>
                        <input type="number" name="preco_unitario" min="0" step="0.01" value={formData.preco_unitario} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    {/* Botões */}
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : (itemToEdit ? 'Salvar Alterações' : 'Adicionar Item')}
                        </button>
                    </div>
                    {message && <p className="text-red-500 text-sm text-center">{message}</p>}
                </form>
            </div>
        </div>
    );
}