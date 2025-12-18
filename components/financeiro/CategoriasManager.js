// components/financeiro/CategoriasManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal';

// Função de busca filtrada por organização
const fetchCategorias = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('nome');
    
    if (error) {
        throw new Error("Erro ao buscar categorias: " + error.message);
    }
    return data || [];
};

export default function CategoriasManager() {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState(null);
    const [defaultModalType, setDefaultModalType] = useState('Despesa');

    const { data: categorias = [], isLoading, error: fetchError } = useQuery({
        queryKey: ['categorias_financeiras', organizacaoId],
        queryFn: () => fetchCategorias(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });

    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            
            // =====================================================================
            // A MÁGICA DA LIMPEZA ACONTECE AQUI ✨
            // Retiramos 'id' e 'children' (que é apenas visual) antes de salvar
            // =====================================================================
            const { id, children, ...dadosParaSalvar } = formData;
            
            const isEditing = Boolean(id);
            let error;

            if (isEditing) {
                // Atualização: Usa os dados limpos + filtro de segurança
                const { error: updateError } = await supabase
                    .from('categorias_financeiras')
                    .update(dadosParaSalvar)
                    .eq('id', id)
                    .eq('organizacao_id', organizacaoId);
                error = updateError;
            } else {
                // Criação: Usa os dados limpos + adiciona o ID da organização
                const { error: insertError } = await supabase
                    .from('categorias_financeiras')
                    .insert({ ...dadosParaSalvar, organizacao_id: organizacaoId });
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
            console.error(error);
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            
            const { error } = await supabase.rpc('delete_category_and_children', { 
                p_category_id: id,
                p_organizacao_id: organizacaoId
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

    // Constrói a árvore visual
    const categoryTree = useMemo(() => {
        const tree = [];
        const map = {};
        
        // 1. Cria um mapa de todos os itens com uma propriedade children vazia
        categorias.forEach(cat => {
            map[cat.id] = { ...cat, children: [] };
        });

        // 2. Conecta os filhos aos pais
        categorias.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) {
                map[cat.parent_id].children.push(map[cat.id]);
            } else {
                tree.push(map[cat.id]); // Se não tem pai, é raiz
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

    // Componente Recursivo para Listagem
    const CategoryList = ({ categories, level = 0 }) => (
        <ul className="divide-y border rounded-md">
            {categories.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nenhuma categoria encontrada.</li>}
            {categories.map(cat => (
                <li key={cat.id}>
                    <div className={`px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors duration-150`} style={{ paddingLeft: `${1 + level * 2}rem` }}>
                        <div className="flex items-center gap-2">
                            <span className={`font-semibold ${level === 0 ? 'text-gray-800' : 'text-gray-600'}`}>{cat.nome}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleOpenEditModal(cat)} 
                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                title="Editar"
                            >
                                <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button 
                                onClick={() => handleDeleteCategoria(cat.id)} 
                                disabled={deleteMutation.isPending} 
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:text-gray-300"
                                title="Excluir"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    </div>
                    {cat.children && cat.children.length > 0 && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                            <CategoryList categories={cat.children} level={level + 1} />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );

    return (
        <div className="space-y-4 group">
            <CategoriaFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveCategoria}
                initialData={editingCategoria}
                allCategories={categorias}
                defaultType={defaultModalType}
            />

            {isLoading ? (
                <div className="text-center p-10 text-gray-500">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" />
                    <p>Carregando plano de contas...</p>
                </div>
            ) : fetchError ? (
                <div className="text-center p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                    <p className="font-bold">Erro ao carregar dados</p>
                    <p className="text-sm">{fetchError.message}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Coluna Receitas */}
                    <div className="bg-white rounded-lg">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-green-100">
                             <h3 className="font-bold text-lg text-green-700 flex items-center gap-2">
                                Receitas
                             </h3>
                             <button 
                                onClick={() => handleOpenAddModal('Receita')} 
                                className="bg-green-600 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={faPlus}/> Nova Receita
                            </button>
                        </div>
                        <CategoryList categories={categoryTree.filter(c => c.tipo === 'Receita')} />
                    </div>

                    {/* Coluna Despesas */}
                    <div className="bg-white rounded-lg">
                          <div className="flex justify-between items-center mb-4 pb-2 border-b border-red-100">
                             <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
                                Despesas
                             </h3>
                              <button 
                                onClick={() => handleOpenAddModal('Despesa')} 
                                className="bg-red-600 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={faPlus}/> Nova Despesa
                            </button>
                          </div>
                        <CategoryList categories={categoryTree.filter(c => c.tipo === 'Despesa')} />
                    </div>
                </div>
            )}
        </div>
    );
}