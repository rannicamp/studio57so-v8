"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal';

// Função de busca de dados foi movida para fora do componente.
// Isso a torna mais reutilizável e organizada.
const fetchCategorias = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('nome');
    
    if (error) {
        throw new Error("Erro ao buscar categorias: " + error.message);
    }
    return data || [];
};

export default function CategoriasManager() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState(null);
    const [defaultModalType, setDefaultModalType] = useState('Despesa');

    // useQuery: O novo "garçom" para buscar os dados.
    // Ele gerencia o loading, erros e cache automaticamente.
    const { data: categorias = [], isLoading, error: fetchError } = useQuery({
        queryKey: ['categorias_financeiras'], // Chave única para identificar essa busca
        queryFn: fetchCategorias,             // Função que executa a busca
    });

    // useMutation para salvar (criar ou atualizar) uma categoria.
    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            const supabase = createClient();
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
                throw new Error(error.message);
            }
            return isEditing;
        },
        onSuccess: (isEditing) => {
            // Quando a operação tem sucesso, invalida a query para buscar os dados atualizados.
            queryClient.invalidateQueries({ queryKey: ['categorias_financeiras'] });
            toast.success(`Categoria ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
            setIsModalOpen(false); // Fecha o modal após o sucesso
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    // useMutation para deletar uma categoria.
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const supabase = createClient();
            const { error } = await supabase.rpc('delete_category_and_children', { p_category_id: id });
            if (error) {
                throw new Error(error.message);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categorias_financeiras'] });
            toast.success('Categoria e subcategorias excluídas com sucesso.');
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        }
    });

    const handleSaveCategoria = async (formData) => {
        await saveMutation.mutateAsync(formData);
        // Retornamos 'true' para compatibilidade com o modal, embora o fechamento agora seja no onSuccess.
        return true;
    };
    
    const handleDeleteCategoria = (id) => {
        if (!window.confirm("Atenção! Excluir uma categoria principal também excluirá todas as suas subcategorias. Deseja continuar?")) return;
        deleteMutation.mutate(id);
    };

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
                            <button onClick={() => handleDeleteCategoria(cat.id)} disabled={deleteMutation.isPending} className="text-red-500 hover:text-red-700 disabled:text-gray-300"><FontAwesomeIcon icon={faTrash} /></button>
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
        <div className="space-y-4">
            <CategoriaFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveCategoria}
                initialData={editingCategoria}
                allCategories={categorias}
                defaultType={defaultModalType}
            />

            {isLoading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : fetchError ? (
                <p className="text-center text-sm font-medium p-2 bg-red-50 text-red-800 rounded-md">{fetchError.message}</p>
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