// components/FeriadoManager.js

"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faCalendarAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

export default function FeriadoManager() {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { userData } = useAuth();

 const [newFeriado, setNewFeriado] = useState({ data_feriado: '', descricao: '', tipo: 'Integral' });

 const { data: feriados = [], isLoading, isError } = useQuery({
 queryKey: ['feriados', userData?.organizacao_id],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('feriados')
 .select('*')
 .eq('organizacao_id', userData.organizacao_id)
 .order('data_feriado', { ascending: true });
 if (error) throw new Error(error.message);
 return data;
 },
 enabled: !!userData?.organizacao_id,
 });

 const addMutation = useMutation({
 mutationFn: async (feriadoData) => {
 const { data, error } = await supabase
 .from('feriados')
 .insert(feriadoData)
 .select()
 .single();
 if (error) throw new Error(error.message);
 return data;
 },
 onSuccess: () => {
 toast.success("Feriado adicionado com sucesso!");
 queryClient.invalidateQueries({ queryKey: ['feriados'] });
 setNewFeriado({ data_feriado: '', descricao: '', tipo: 'Integral' });
 },
 onError: (error) => toast.error(`Erro: ${error.message}`),
 });

 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 const { error } = await supabase.from('feriados').delete().eq('id', id);
 if (error) throw new Error(error.message);
 },
 onSuccess: () => {
 toast.success("Feriado excluído com sucesso!");
 queryClient.invalidateQueries({ queryKey: ['feriados'] });
 },
 onError: (error) => toast.error(`Erro: ${error.message}`),
 });

 const handleAddFeriado = () => {
 if (!newFeriado.data_feriado || !newFeriado.descricao) {
 toast.error("Por favor, preencha a data e a descrição.");
 return;
 }
 addMutation.mutate({ ...newFeriado, organizacao_id: userData.organizacao_id });
 };

 const handleDeleteFeriado = (id) => {
 toast("Tem certeza que deseja excluir?", {
 action: { label: "Sim, excluir", onClick: () => deleteMutation.mutate(id) },
 cancel: { label: "Cancelar" },
 });
 };

 const formatDate = (dateString) => {
 if (!dateString) return '';
 // Regra #5: Trata a data como texto para evitar erros de fuso horário.
 const [year, month, day] = dateString.split('-');
 return `${day}/${month}/${year}`;
 };

 const isProcessing = addMutation.isPending || deleteMutation.isPending;

 return (
 <div className="space-y-6 w-full">
 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between gap-6">
 <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 rounded-l-3xl"></div>

 <div className="pl-4 flex items-center justify-between">
 <div>
 <h2 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
 <FontAwesomeIcon icon={faCalendarAlt} />
 </div>
 Feriados Cadastrados
 </h2>
 </div>
 </div>

 <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 backdrop-blur-sm shadow-inner transition-all">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
 <div className="md:col-span-2">
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Descrição do Feriado</label>
 <input
 type="text"
 placeholder="Ex: Natal"
 value={newFeriado.descricao}
 onChange={e => setNewFeriado({ ...newFeriado, descricao: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-300"
 />
 </div>
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Data Exata</label>
 <input
 type="date"
 value={newFeriado.data_feriado}
 onChange={e => setNewFeriado({ ...newFeriado, data_feriado: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 />
 </div>
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Tipo de Recesso</label>
 <select
 value={newFeriado.tipo}
 onChange={e => setNewFeriado({ ...newFeriado, tipo: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 >
 <option value="Integral">Dia Integral</option>
 <option value="Meio Período">Meio Período</option>
 </select>
 </div>
 </div>

 <div className="flex justify-end mt-6">
 <button
 onClick={handleAddFeriado}
 disabled={isProcessing}
 className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-extrabold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 transform active:scale-95 disabled:opacity-50"
 >
 {addMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
 {addMutation.isPending ? 'Salvando...' : 'Adicionar Feriado'}
 </button>
 </div>
 </div>
 </div>

 <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
 {isLoading && (
 <div className="flex flex-col items-center justify-center p-12 space-y-4">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
 <p className="text-gray-400 font-medium text-sm animate-pulse">Consultando calendário de feriados...</p>
 </div>
 )}
 {isError && (
 <div className="p-12 text-center">
 <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex mx-auto items-center justify-center mb-4 text-red-500 text-2xl">
 <FontAwesomeIcon icon={faExclamationTriangle} />
 </div>
 <p className="text-red-500 font-bold">Erro intermitente. Tente recarregar a página.</p>
 </div>
 )}

 {!isLoading && !isError && feriados.length > 0 && (
 <div className="overflow-x-auto custom-scrollbar">
 <table className="min-w-full divide-y divide-gray-100">
 <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10">
 <tr>
 <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 uppercase tracking-widest border-b border-gray-200/60 w-32">Data Nacional</th>
 <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 uppercase tracking-widest border-b border-gray-200/60">Descrição / Título</th>
 <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 uppercase tracking-widest border-b border-gray-200/60">Peso de Escala</th>
 <th className="px-6 py-4 text-right text-[11px] font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-200/60">Opções</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {feriados.map(feriado => (
 <tr key={feriado.id} className="hover:bg-blue-50/30 transition-colors group">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-indigo-700">{formatDate(feriado.data_feriado)}</td>
 <td className="px-6 py-4 text-sm font-bold text-gray-700">{feriado.descricao}</td>
 <td className="px-6 py-4">
 <span className={`px-4 py-1.5 text-xs font-extrabold rounded-full shadow-sm border ${feriado.tipo === 'Integral' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
 {feriado.tipo}
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <button
 onClick={() => handleDeleteFeriado(feriado.id)}
 disabled={isProcessing}
 className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100 disabled:opacity-50"
 title="Excluir Feriado"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {!isLoading && !isError && feriados.length === 0 && (
 <div className="p-16 text-center flex flex-col items-center">
 <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex mx-auto items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform">
 <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-300 text-3xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-800 mb-2">Folha de Feriados Vazia</h3>
 <p className="text-xs font-medium text-gray-400 max-w-sm mx-auto">Adicione os feriados nacionais ou municipais acima. Eles isentam seus colaboradores de faltas computadas.</p>
 </div>
 )}
 </div>
 </div>
 );
}

// --------------------------------------------------------------------------------
// RESUMO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente gerencia o cadastro de feriados para uma organização.
// Ele foi refatorado para usar `useQuery` para buscar a lista de feriados
// dinamicamente e `useMutation` para adicionar e remover registros.
// Todas as operações agora incluem o `organizacao_id` e atualizam a interface
// do usuário em tempo real. A formatação de datas foi corrigida para evitar
// problemas de fuso horário, tratando a data como texto.
// --------------------------------------------------------------------------------