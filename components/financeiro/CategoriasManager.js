// components/financeiro/CategoriasManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faEdit, faTrash, faTags } from '@fortawesome/free-solid-svg-icons';
import CategoriaFormModal from './CategoriaFormModal';
import CategoriaDeleteModal from './CategoriaDeleteModal'; // <--- IMPORT NOVO

const fetchCategorias = async (supabase, organizacaoId) => {
 if (!organizacaoId) return [];
 const { data, error } = await supabase
 .from('categorias_financeiras')
 .select('*')
 .in('organizacao_id', [organizacaoId, 1])
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

 // Estados para Modais
 const [isFormModalOpen, setIsFormModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // <--- NOVO

 const [editingCategoria, setEditingCategoria] = useState(null);
 const [deletingCategoria, setDeletingCategoria] = useState(null); // <--- NOVO
 const [defaultModalType, setDefaultModalType] = useState('Despesa');

 const { data: categorias = [], isLoading, error: fetchError } = useQuery({
 queryKey: ['categorias_financeiras', organizacaoId],
 queryFn: () => fetchCategorias(supabase, organizacaoId),
 enabled: !!organizacaoId,
 });

 // Mutação de Salvamento (mantida igual a anterior)
 const saveMutation = useMutation({
 mutationFn: async (formData) => {
 if (!organizacaoId) throw new Error("Organização não identificada.");
 const { id, children, ...dadosParaSalvar } = formData;
 const isEditing = Boolean(id);
 let error;

 if (isEditing) {
 const { error: updateError } = await supabase
 .from('categorias_financeiras')
 .update(dadosParaSalvar)
 .eq('id', id)
 .eq('organizacao_id', organizacaoId);
 error = updateError;
 } else {
 const { error: insertError } = await supabase
 .from('categorias_financeiras')
 .insert({ ...dadosParaSalvar, organizacao_id: organizacaoId });
 error = insertError;
 }

 if (error) throw new Error(error.message);
 return isEditing;
 },
 onSuccess: (isEditing) => {
 queryClient.invalidateQueries({ queryKey: ['categorias_financeiras', organizacaoId] });
 toast.success(`Categoria ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
 setIsFormModalOpen(false);
 },
 onError: (error) => toast.error(`Erro ao salvar: ${error.message}`)
 });

 // =========================================================================
 // NOVA MUTAÇÃO DE EXCLUSÃO COM MIGRAÇÃO
 // =========================================================================
 const deleteMutation = useMutation({
 mutationFn: async ({ id, newCategoryId }) => {
 if (!organizacaoId) throw new Error("Organização não identificada.");

 // Chama a RPC que criamos no Passo 1
 const { error } = await supabase.rpc('excluir_categoria_e_migrar', {
 p_categoria_id: id,
 p_nova_categoria_id: newCategoryId, // Pode ser null (órfão) ou UUID (migrar)
 p_organizacao_id: organizacaoId
 });

 if (error) throw new Error(error.message);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['categorias_financeiras', organizacaoId] });
 // Atualiza também os lançamentos, pois eles mudaram
 queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
 toast.success('Categoria excluída e lançamentos processados com sucesso.');
 setIsDeleteModalOpen(false);
 setDeletingCategoria(null);
 },
 onError: (error) => toast.error(`Erro ao excluir: ${error.message}`)
 });

 const handleSaveCategoria = async (formData) => {
 await saveMutation.mutateAsync(formData);
 return true;
 };

 // Agora apenas abre o modal, não deleta direto
 const handleDeleteClick = (categoria) => {
 setDeletingCategoria(categoria);
 setIsDeleteModalOpen(true);
 };

 const handleConfirmDelete = (id, newCategoryId) => {
 deleteMutation.mutate({ id, newCategoryId });
 };

 const categoryTree = useMemo(() => {
 const tree = [];
 const map = {};
 categorias.forEach(cat => { map[cat.id] = { ...cat, children: [] }; });
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
 setIsFormModalOpen(true);
 };

 const handleOpenEditModal = (categoria) => {
 setEditingCategoria(categoria);
 setIsFormModalOpen(true);
 };

 // Função para adicionar uma filha direta à categoria selecionada
 const handleOpenAddSubModal = (parentCategoria) => {
 // Envia como "initialData" parcial com a dica do pai e do tipo, não sendo uma edição real de um ID.
 setEditingCategoria({
 nome: '',
 tipo: parentCategoria.tipo,
 parent_id: parentCategoria.id
 });
 setDefaultModalType(parentCategoria.tipo);
 setIsFormModalOpen(true);
 };

 const CategoryList = ({ categories, level = 0 }) => (
 <ul className="divide-y border rounded-md">
 {categories.length === 0 && (
 <li className="p-8 text-center bg-gray-50 rounded-lg m-4 border border-dashed border-gray-200">
 <FontAwesomeIcon icon={faTags} className="text-4xl text-gray-300 mb-3" />
 <h3 className="text-sm font-semibold text-gray-700">Nenhuma categoria</h3>
 <p className="text-xs text-gray-500 mt-1">Crie uma nova categoria acima.</p>
 </li>
 )}
 {categories.map(cat => (
 <li key={cat.id}>
 <div className={`group px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors duration-150`} style={{ paddingLeft: `${1 + level * 2}rem` }}>
 <div className="flex items-center gap-2">
 <span className={`font-semibold ${level === 0 ? 'text-gray-800' : 'text-gray-600'}`}>{cat.nome}</span>
 </div>
 <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
 {cat.organizacao_id !== 1 && (
 <>
 <button
 onClick={() => handleOpenAddSubModal(cat)}
 className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
 title="Nova Subcategoria"
 >
 <FontAwesomeIcon icon={faPlus} />
 </button>
 <button
 onClick={() => handleOpenEditModal(cat)}
 className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
 title="Editar"
 >
 <FontAwesomeIcon icon={faEdit} />
 </button>
 <button
 onClick={() => handleDeleteClick(cat)}
 disabled={deleteMutation.isPending}
 className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:text-gray-300"
 title="Excluir"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </>
 )}
 {cat.organizacao_id === 1 && (
 <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-md" title="Categoria Global do Sistema">
 [Sistema]
 </span>
 )}
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
 <div className="space-y-4">
 {/* Modal de Criação/Edição */}
 <CategoriaFormModal
 isOpen={isFormModalOpen}
 onClose={() => setIsFormModalOpen(false)}
 onSave={handleSaveCategoria}
 initialData={editingCategoria}
 allCategories={categorias}
 defaultType={defaultModalType}
 />

 {/* Modal de Exclusão Inteligente */}
 <CategoriaDeleteModal
 isOpen={isDeleteModalOpen}
 onClose={() => setIsDeleteModalOpen(false)}
 onConfirm={handleConfirmDelete}
 categoria={deletingCategoria}
 allCategories={categorias}
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
 <h3 className="font-bold text-lg text-green-700 flex items-center gap-2">Receitas</h3>
 <button onClick={() => handleOpenAddModal('Receita')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 text-xs uppercase tracking-wide">
 <FontAwesomeIcon icon={faPlus} className="mr-2" /> Nova Receita
 </button>
 </div>
 <CategoryList categories={categoryTree.filter(c => c.tipo === 'Receita')} />
 </div>

 {/* Coluna Despesas */}
 <div className="bg-white rounded-lg">
 <div className="flex justify-between items-center mb-4 pb-2 border-b border-red-100">
 <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">Despesas</h3>
 <button onClick={() => handleOpenAddModal('Despesa')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 text-xs uppercase tracking-wide">
 <FontAwesomeIcon icon={faPlus} className="mr-2" /> Nova Despesa
 </button>
 </div>
 <CategoryList categories={categoryTree.filter(c => c.tipo === 'Despesa')} />
 </div>
 </div>
 )}
 </div>
 );
}