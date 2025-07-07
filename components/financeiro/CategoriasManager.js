"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal';

export default function CategoriasManager() {
    const supabase = createClient();
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState(null);
    // Novo estado para controlar o tipo padrão do modal
    const [defaultModalType, setDefaultModalType] = useState('Despesa');
    const [message, setMessage] = useState('');

    const fetchCategorias = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('categorias_financeiras')
            .select('*')
            .order('nome');
        
        if (error) setMessage("Erro ao buscar categorias: " + error.message);
        else setCategorias(data || []);
        
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchCategorias();
    }, [fetchCategorias]);

    const categoryTree = useMemo(() => {
        const tree = [];
        const map = {};
        
        categorias.forEach(cat => {
            map[cat.id] = { ...cat, children: [] };
        });

        categorias.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) {
                map[cat.parent_id].children.push(map[cat.id]);
            } else {
                tree.push(map[cat.id]);
            }
        });

        return tree;
    }, [categorias]);

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
        if (!window.confirm("Atenção! Excluir uma categoria principal também excluirá todas as suas subcategorias. Deseja continuar?")) return;
        
        const { error } = await supabase.rpc('delete_category_and_children', { p_category_id: id });

        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage('Categoria e subcategorias excluídas com sucesso.');
            fetchCategorias();
        }
    };

    // Função alterada para receber o tipo
    const handleOpenAddModal = (type) => {
        setDefaultModalType(type);
        setEditingCategoria(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (categoria) => {
        setEditingCategoria(categoria);
        setIsModalOpen(true);
    };

    const CategoryList = ({ categories, level = 0 }) => (
        <ul className="divide-y border rounded-md">
            {categories.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nenhuma categoria encontrada.</li>}
            {categories.map(cat => (
                <li key={cat.id}>
                    <div className={`px-4 py-3 flex justify-between items-center hover:bg-gray-50`} style={{ paddingLeft: `${1 + level * 2}rem` }}>
                        <span className="font-semibold">{cat.nome}</span>
                        <div className="space-x-3">
                            <button onClick={() => handleOpenEditModal(cat)} className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faPenToSquare} /></button>
                            <button onClick={() => handleDeleteCategoria(cat.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                    </div>
                    {cat.children && cat.children.length > 0 && (
                        <ul className="bg-gray-50">
                            <CategoryList categories={cat.children} level={level + 1} />
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <CategoriaFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveCategoria}
                initialData={editingCategoria}
                allCategories={categorias}
                // Passando o tipo padrão para o modal
                defaultType={defaultModalType}
            />
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Gerenciar Categorias</h2>
            </div>
             {message && <p className="text-center text-sm font-medium p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            {loading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="font-semibold text-lg text-green-700">Receitas</h3>
                             <button onClick={() => handleOpenAddModal('Receita')} className="bg-green-600 text-white px-3 py-1 text-xs rounded-md hover:bg-green-700 flex items-center gap-1"><FontAwesomeIcon icon={faPlus}/> Nova Receita</button>
                        </div>
                        <CategoryList categories={categoryTree.filter(c => c.tipo === 'Receita')} />
                    </div>
                    <div>
                         <div className="flex justify-between items-center mb-2">
                             <h3 className="font-semibold text-lg text-red-700">Despesas</h3>
                              <button onClick={() => handleOpenAddModal('Despesa')} className="bg-red-600 text-white px-3 py-1 text-xs rounded-md hover:bg-red-700 flex items-center gap-1"><FontAwesomeIcon icon={faPlus}/> Nova Despesa</button>
                        </div>
                        <CategoryList categories={categoryTree.filter(c => c.tipo === 'Despesa')} />
                    </div>
                </div>
            )}
        </div>
    );
}