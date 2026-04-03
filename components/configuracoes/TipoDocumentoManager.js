//components\TipoDocumentoManager.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faSpinner, faSave, faFileAlt } from '@fortawesome/free-solid-svg-icons';

export default function TipoDocumentoManager({ initialData }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const [tipos, setTipos] = useState(initialData || []);
 const [newTipo, setNewTipo] = useState({ sigla: '', descricao: '' });
 const [editingId, setEditingId] = useState(null);
 const [editingData, setEditingData] = useState({ sigla: '', descricao: '' });

 // Função de sucesso para invalidar o cache e recarregar os dados
 const handleSuccess = () => {
 queryClient.invalidateQueries({ queryKey: ['documento_tipos', organizacaoId] });
 };

 // =================================================================================
 // FUNDAÇÃO REFORÇADA E ACABAMENTO DE LUXO
 // O PORQUÊ: Usamos useMutation para padronizar a criação, atualização e exclusão.
 // Isso centraliza a lógica, remove a necessidade de `useState` para loading/message
 // e permite usar `toast.promise` para um feedback claro e elegante.
 // A `organizacao_id` é a nossa "etiqueta de segurança" na criação.
 // =================================================================================
 const addMutation = useMutation({
 mutationFn: async (newTipoData) => {
 if (!newTipoData.sigla || !newTipoData.descricao) throw new Error("Sigla e Descrição são obrigatórias.");
 if (!organizacaoId) throw new Error("Organização não identificada.");

 const { data, error } = await supabase
 .from('documento_tipos')
 .insert({ ...newTipoData, organizacao_id: organizacaoId }) // <-- A ETIQUETA DE SEGURANÇA!
 .select()
 .single();

 if (error) throw error;
 return data;
 },
 onSuccess: (data) => {
 setTipos([...tipos, data]);
 setNewTipo({ sigla: '', descricao: '' });
 handleSuccess();
 },
 });

 const updateMutation = useMutation({
 mutationFn: async ({ id, data }) => {
 const { data: updatedData, error } = await supabase
 .from('documento_tipos')
 .update(data)
 .eq('id', id)
 .select()
 .single();
 if (error) throw error;
 return updatedData;
 },
 onSuccess: (data) => {
 setTipos(tipos.map(t => t.id === data.id ? data : t));
 setEditingId(null);
 handleSuccess();
 },
 });

 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 const { error } = await supabase.from('documento_tipos').delete().eq('id', id);
 if (error) throw error;
 return id;
 },
 onSuccess: (id) => {
 setTipos(tipos.filter(t => t.id !== id));
 handleSuccess();
 },
 });

 const handleSaveNew = () => {
 toast.promise(addMutation.mutateAsync(newTipo), {
 loading: 'Adicionando tipo...',
 success: 'Tipo de documento adicionado com sucesso!',
 error: (err) => err.message,
 });
 };

 const handleUpdate = (id) => {
 toast.promise(updateMutation.mutateAsync({ id, data: editingData }), {
 loading: 'Atualizando tipo...',
 success: 'Tipo de documento atualizado com sucesso!',
 error: (err) => err.message,
 });
 };

 const handleDelete = (id) => {
 toast("Confirmar Exclusão", {
 description: "Tem certeza que deseja excluir este tipo de documento?",
 action: {
 label: "Excluir",
 onClick: () => toast.promise(deleteMutation.mutateAsync(id), {
 loading: 'Excluindo...',
 success: 'Tipo de documento excluído com sucesso!',
 error: (err) => `Erro ao excluir: ${err.message}`,
 }),
 },
 cancel: { label: "Cancelar" },
 classNames: { actionButton: 'bg-red-600' },
 });
 };

 const isMutating = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

 return (
 <div className="space-y-6">
 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between gap-6">

 {/* Lateral sólida e elegante (sem gradiente) */}
 <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 rounded-l-3xl"></div>

 <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pl-4 z-10 w-full">
 <div>
 <h2 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
 <FontAwesomeIcon icon={faFileAlt} className="text-blue-600" />
 Tipos de Documento
 </h2>
 <p className="text-sm font-medium text-gray-500 mt-1">Crie as siglas padronizadas para anexos do sistema.</p>
 </div>
 </div>

 <div className="bg-gray-50/50 rounded-2xl p-4 md:p-6 border border-gray-100 shadow-inner z-10 w-full flex flex-col md:flex-row items-center gap-4">
 <div className="flex-1 w-full relative">
 <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sigla (ID)</label>
 <input
 type="text"
 placeholder="Ex: CONTR"
 value={newTipo.sigla}
 onChange={(e) => setNewTipo({ ...newTipo, sigla: e.target.value.toUpperCase() })}
 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
 />
 </div>
 <div className="flex-[2] w-full relative">
 <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Descrição da Sigla</label>
 <input
 type="text"
 placeholder="Ex: Contrato de Serviço"
 value={newTipo.descricao}
 onChange={(e) => setNewTipo({ ...newTipo, descricao: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
 />
 </div>
 <div className="w-full md:w-auto mt-auto flex items-end">
 <button
 onClick={handleSaveNew}
 disabled={isMutating}
 className="w-full md:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {addMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
 {addMutation.isPending ? 'Salvando...' : 'Adicionar Sigla'}
 </button>
 </div>
 </div>
 </div>

 {tipos.length > 0 ? (
 <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
 <div className="overflow-x-auto w-full">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-gray-50/80 border-b border-gray-100">
 <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Sigla</th>
 <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Descrição</th>
 <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {tipos.map(tipo => (
 <tr key={tipo.id} className="hover:bg-blue-50/30 transition-colors group">
 {editingId === tipo.id ? (
 <>
 <td className="px-6 py-4">
 <input
 type="text"
 value={editingData.sigla}
 onChange={e => setEditingData({ ...editingData, sigla: e.target.value.toUpperCase() })}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
 />
 </td>
 <td className="px-6 py-4">
 <input
 type="text"
 value={editingData.descricao}
 onChange={e => setEditingData({ ...editingData, descricao: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
 />
 </td>
 <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
 <button
 onClick={() => handleUpdate(tipo.id)}
 disabled={isMutating}
 className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors inline-flex items-center justify-center shadow-sm disabled:opacity-50"
 title="Salvar"
 >
 {updateMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
 </button>
 <button
 onClick={() => setEditingId(null)}
 className="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors inline-flex items-center justify-center shadow-sm"
 title="Cancelar"
 >
 X
 </button>
 </td>
 </>
 ) : (
 <>
 <td className="px-6 py-4">
 <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 text-blue-700 font-extrabold text-xs shadow-[0_1px_2px_0_rgba(37,99,235,0.1)]">
 {tipo.sigla}
 </span>
 </td>
 <td className="px-6 py-4 text-sm font-semibold text-gray-700">{tipo.descricao}</td>
 <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
 <button
 onClick={() => { setEditingId(tipo.id); setEditingData(tipo); }}
 className="w-8 h-8 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all inline-flex items-center justify-center shadow-sm"
 title="Editar Tipo"
 >
 <FontAwesomeIcon icon={faPen} />
 </button>
 <button
 onClick={() => handleDelete(tipo.id)}
 className="w-8 h-8 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all inline-flex items-center justify-center shadow-sm"
 title="Excluir Tipo"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </td>
 </>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ) : (
 <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm w-full">
 <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex mx-auto items-center justify-center mb-4 shadow-sm transition-transform hover:scale-105">
 <FontAwesomeIcon icon={faFileAlt} className="text-gray-300 text-xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum Tipo de Documento Cadastrado</h3>
 <p className="text-xs font-medium text-gray-400 max-w-sm mx-auto">Sua organização ainda não padronizou as siglas para envio de documentos e atestados.</p>
 </div>
 )}
 </div>
 );
}