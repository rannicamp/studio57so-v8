"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal'; // Importando o formulário real

export default function CategoriasManager() {
    const supabase = createClient();
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState(null);
    const [message, setMessage] = useState('');

    const fetchCategorias = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('categorias_financeiras')
            .select('*')
            .order('tipo')
            .order('nome');
        
        if (error) setMessage("Erro ao buscar categorias: " + error.message);
        else setCategorias(data || []);
        
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchCategorias();
    }, [fetchCategorias]);

    const handleSaveCategoria = async (formData) => {
        const isEditing = Boolean(formData.id);
        
        let error;
        if (isEditing) {
            const { id, ...updateData } = formData;
            const { error: updateError } = await supabase.from('categorias_financeiras').update(updateData).eq('id', id);
            error = updateError;
        } else {
            delete formData.id;
            const { error: insertError } = await supabase.from('categorias_financeiras').insert(formData);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro: ${error.message}`);
            return false;
        }

        setMessage(`Categoria ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
        setTimeout(() => setMessage(''), 3000);
        fetchCategorias();
        return true;
    };
    
    const handleDeleteCategoria = async (id) => {
        if (!window.confirm("Tem certeza? Excluir uma categoria pode desassociá-la de lançamentos existentes.")) return;
        await supabase.from('categorias_financeiras').delete().eq('id', id);
        fetchCategorias();
        setMessage('Categoria excluída.');
    };

    const handleOpenAddModal = () => {
        setEditingCategoria(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (categoria) => {
        setEditingCategoria(categoria);
        setIsModalOpen(true);
    };

    const categoriasReceita = categorias.filter(c => c.tipo === 'Receita');
    const categoriasDespesa = categorias.filter(c => c.tipo === 'Despesa');

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <CategoriaFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveCategoria}
                initialData={editingCategoria}
            />
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Gerenciar Categorias</h2>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Nova Categoria
                </button>
            </div>
             {message && <p className="text-center text-sm font-medium p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            {loading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-lg text-green-700 mb-2">Categorias de Receita</h3>
                        <ul className="divide-y border rounded-md">
                            {categoriasReceita.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nenhuma categoria de receita.</li>}
                            {categoriasReceita.map(cat => (
                                <li key={cat.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                                    <span>{cat.nome}</span>
                                    <div className="space-x-3">
                                        <button onClick={() => handleOpenEditModal(cat)} className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                        <button onClick={() => handleDeleteCategoria(cat.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-red-700 mb-2">Categorias de Despesa</h3>
                        <ul className="divide-y border rounded-md">
                            {categoriasDespesa.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nenhuma categoria de despesa.</li>}
                            {categoriasDespesa.map(cat => (
                                <li key={cat.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                                    <span>{cat.nome}</span>
                                    <div className="space-x-3">
                                        <button onClick={() => handleOpenEditModal(cat)} className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                        <button onClick={() => handleDeleteCategoria(cat.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}