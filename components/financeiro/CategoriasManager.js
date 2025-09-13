//components\financeiro\CategoriasManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal';

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organizacao_id)
// O PORQUÊ: A função de busca agora é filtrada pela organização, garantindo
// que apenas as categorias da empresa correta sejam exibidas.
// =================================================================================
const fetchCategorias = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('nome');
    
    if (error) {
        throw new Error("Erro ao buscar categorias: " + error.message);
    }
    return data || [];
};

export default function CategoriasManager() {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState(null);
    const [defaultModalType, setDefaultModalType] = useState('Despesa');

    const { data: categorias = [], isLoading, error: fetchError } = useQuery({
        // A queryKey agora inclui o organizacaoId para um cache seguro
        queryKey: ['categorias_financeiras', organizacaoId],
        queryFn: () => fetchCategorias(supabase, organizacaoId),
        enabled: !!organizacaoId, // A busca só é ativada se tivermos o ID da organização
    });

    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            const isEditing = Boolean(formData.id);
            let error;

            if (isEditing) {
                const { id, ...updateData } = formData;
                // Adiciona o filtro de segurança no update
                const { error: updateError } = await supabase.from('categorias_financeiras').update(updateData).eq('id', id).eq('organizacao_id', organizacaoId);
                error = updateError;
            } else {
                delete formData.id;
                // Adiciona a "etiqueta de segurança" na criação
                const { error: insertError } = await supabase.from('categorias_financeiras').insert({ ...formData, organizacao_id: organizacaoId });
                error = insertError;
            }

            if (error) {
                throw new Error(error.message);
            }
            return isEditing;
        },
        onSuccess: (isEditing) => {
            queryClient.invalidateQueries({ queryKey: ['categorias_financeiras', organizacaoId] });
            toast.success(`Categoria ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
            setIsModalOpen(false);
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            // Passamos o organizacaoId para a função do banco de dados
            const { error } = await supabase.rpc('delete_category_and_children', { 
                p_category_id: id,
                p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
            });
            if (error) {
                throw new Error(error.message);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categorias_financeiras', organizacaoId] });
            toast.success('Categoria e subcategorias excluídas com sucesso.');
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        }
    });

    const handleSaveCategoria = async (formData) => {
        await saveMutation.mutateAsync(formData);
        return true;
    };
    
    // =================================================================================
    // ATUALIZAÇÃO DE UX (troca de window.confirm por toast)
    // O PORQUÊ: Substituímos o alerta nativo por uma notificação mais elegante.
    // =================================================================================
    const handleDeleteCategoria = (id) => {
        toast("Confirmar Exclusão", {
            description: "Atenção! Excluir uma categoria principal também excluirá todas as suas subcategorias. Deseja continuar?",
            action: {
                label: "Excluir",
                onClick: () => deleteMutation.mutate(id)
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
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