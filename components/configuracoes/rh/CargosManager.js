'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// USO DE @/ PARA EVITAR ERROS DE CAMINHO
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faSpinner, faBriefcase } from '@fortawesome/free-solid-svg-icons';

export default function CargosManager() {
 const supabase = createClient();
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const organizacao_id = user?.organizacao_id;

 const [editingId, setEditingId] = useState(null);
 const [editName, setEditName] = useState('');
 const [newName, setNewName] = useState('');

 // Buscar Cargos
 const { data: cargos = [], isLoading } = useQuery({
 queryKey: ['cargos', organizacao_id],
 queryFn: async () => {
 if (!organizacao_id) return [];
 const { data, error } = await supabase
 .from('cargos')
 .select('*')
 .eq('organizacao_id', organizacao_id)
 .order('nome');
 if (error) throw error;
 return data;
 },
 enabled: !!organizacao_id
 });

 // Criar Cargo
 const createMutation = useMutation({
 mutationFn: async (nome) => {
 const { error } = await supabase.from('cargos').insert({ nome, organizacao_id });
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['cargos']);
 setNewName('');
 toast.success('Cargo criado!');
 },
 onError: (err) => toast.error('Erro ao criar: ' + err.message)
 });

 // Editar Cargo
 const updateMutation = useMutation({
 mutationFn: async ({ id, nome }) => {
 const { error } = await supabase.from('cargos').update({ nome }).eq('id', id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['cargos']);
 setEditingId(null);
 toast.success('Cargo atualizado!');
 },
 onError: (err) => toast.error('Erro ao editar: ' + err.message)
 });

 // Excluir Cargo
 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 // Verifica se tem uso na tabela de funcionários
 const { count } = await supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('cargo_id', id);
 if (count > 0) throw new Error(`Este cargo está vinculado a ${count} funcionários. Não pode ser excluído.`);

 const { error } = await supabase.from('cargos').delete().eq('id', id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['cargos']);
 toast.success('Cargo removido.');
 },
 onError: (err) => toast.error(err.message)
 });

 const handleEdit = (cargo) => {
 setEditingId(cargo.id);
 setEditName(cargo.nome);
 };

 const handleSaveEdit = () => {
 if (!editName.trim()) return;
 updateMutation.mutate({ id: editingId, nome: editName });
 };

 return (
 <div className="max-w-5xl mx-auto space-y-6">
 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4">
 <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 rounded-l-3xl"></div>
 <div className="pl-4">
 <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Cargos e Níveis</h2>
 <p className="text-sm text-gray-400 font-medium">Cadastre todos os papéis hierárquicos vigentes na empresa.</p>
 </div>
 {/* Adicionar Novo */}
 <div className="flex w-full sm:w-auto gap-2 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100 backdrop-blur-sm shadow-inner transition-all focus-within:ring-2 focus-within:ring-blue-100">
 <input
 type="text"
 placeholder="Nome do cargo (ex: Gerente)"
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 className="flex-1 min-w-[200px] bg-transparent border-none text-sm font-bold text-gray-700 placeholder-gray-400 focus:ring-0 px-4 outline-none"
 />
 <button
 onClick={() => newName && createMutation.mutate(newName)}
 disabled={createMutation.isPending || !newName}
 className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm hover:bg-blue-700 shadow-sm disabled:opacity-50 font-extrabold flex items-center transition-all"
 >
 {createMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} className="mr-2" />}
 Adicionar
 </button>
 </div>
 </div>

 {/* Lista */}
 {isLoading ? (
 <div className="flex flex-col items-center justify-center p-12 space-y-4">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
 <p className="text-gray-400 font-medium text-sm animate-pulse">Consultando papéis...</p>
 </div>
 ) : (
 <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
 <div className="overflow-x-auto custom-scrollbar">
 <table className="min-w-full divide-y divide-gray-100">
 <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10">
 <tr>
 <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 uppercase tracking-widest border-b border-gray-200/60">Responsabilidades Mapeadas</th>
 <th className="px-6 py-4 text-right text-[11px] font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-200/60">Opções</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {cargos.map((cargo) => (
 <tr key={cargo.id} className="hover:bg-blue-50/30 transition-colors group">
 <td className="px-6 py-4 whitespace-nowrap">
 {editingId === cargo.id ? (
 <input
 autoFocus
 type="text"
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 onBlur={handleSaveEdit}
 onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
 className="w-full sm:w-1/2 bg-white border border-blue-200 rounded-lg p-2 text-sm font-bold text-gray-800 shadow-inner focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-gray-300"
 placeholder="Digite o novo nome e dê Enter..."
 />
 ) : (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shadow-sm">
 <FontAwesomeIcon icon={faBriefcase} />
 </div>
 <span className="text-gray-700 font-extrabold text-sm">{cargo.nome}</span>
 </div>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
 <button
 onClick={() => handleEdit(cargo)}
 className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-all shadow-sm border border-transparent hover:border-blue-100"
 title="Renomear"
 >
 <FontAwesomeIcon icon={faPen} />
 </button>
 <button
 onClick={() => { if (confirm(`Deseja realmente apagar o cargo ${cargo.nome}?`)) deleteMutation.mutate(cargo.id) }}
 className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100"
 title="Excluir Definitivamente"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </td>
 </tr>
 ))}
 {cargos.length === 0 && (
 <tr>
 <td colSpan="2" className="px-6 py-12">
 <div className="flex flex-col items-center justify-center text-center">
 <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
 <FontAwesomeIcon icon={faBriefcase} className="text-gray-300 text-xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-800 mb-1">Cargos Inexistentes</h3>
 <p className="text-xs font-medium text-gray-400 max-w-xs">A base está ociosa. Crie o primeiro cargo hierárquico lá em cima para compor a ficha de funcionários.</p>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
}