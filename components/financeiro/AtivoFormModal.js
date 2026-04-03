"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSave, faChartLine, faChartBar } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';

export default function AtivoFormModal({ isOpen, onClose, onSuccess, contasPatrimoniais = [], initialData }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { user, organizacao_id: organizacaoId } = useAuth();

 const isEditing = Boolean(initialData?.id);

 const getInitialState = () => ({
 tipo: 'Ativo',
 descricao: '',
 valor: '',
 data_transacao: new Date().toISOString().split('T')[0],
 conta_id: '',
 categoria_id: null,
 observacoes: '',
 });

 const [formData, setFormData] = useState(getInitialState());

 useEffect(() => {
 if (isOpen) {
 if (initialData) {
 setFormData({
 tipo: initialData.tipo || 'Ativo',
 descricao: initialData.descricao || '',
 valor: initialData.valor ? String(initialData.valor) : '',
 data_transacao: initialData.data_transacao || new Date().toISOString().split('T')[0],
 conta_id: initialData.conta_id || '',
 categoria_id: initialData.categoria_id || null,
 observacoes: initialData.observacao || '',
 });
 } else {
 setFormData(getInitialState());
 }
 }
 }, [isOpen, initialData]);

 const { data: categorias = [] } = useQuery({
 queryKey: ['categorias-patrimonio', organizacaoId],
 queryFn: async () => {
 const { data } = await supabase
 .from('categorias_financeiras')
 .select('id, nome, tipo')
 .in('organizacao_id', [organizacaoId, 1])
 .in('tipo', ['Ativo', 'Passivo'])
 .order('nome');
 return data || [];
 },
 enabled: isOpen && !!organizacaoId,
 });

 const mutation = useMutation({
 mutationFn: async (data) => {
 if (!organizacaoId) throw new Error('Organização não encontrada');
 const valorNumerico = parseFloat(String(data.valor || '0').replace(',', '.')) || 0;

 const payload = {
 tipo: data.tipo,
 descricao: data.descricao,
 valor: valorNumerico,
 data_transacao: data.data_transacao,
 data_vencimento: data.data_transacao,
 conta_id: data.conta_id,
 status: 'Pago',
 data_pagamento: data.data_transacao,
 observacao: data.observacoes,
 categoria_id: data.categoria_id || null,
 organizacao_id: organizacaoId,
 };

 if (isEditing) {
 const { error } = await supabase.from('lancamentos').update(payload).eq('id', initialData.id);
 if (error) throw error;
 } else {
 const { error } = await supabase.from('lancamentos').insert({
 ...payload,
 criado_por_usuario_id: user.id,
 });
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success(isEditing ? `${formData.tipo} atualizado!` : `${formData.tipo} registrado!`);
 if (onSuccess) onSuccess();
 onClose();
 },
 onError: (err) => toast.error(`Erro: ${err.message}`),
 });

 const handleSubmit = (e) => {
 e.preventDefault();
 if (!formData.conta_id) return toast.error('Selecione uma Conta Patrimonial');
 if (!formData.descricao) return toast.error('Informe a descrição');
 mutation.mutate(formData);
 };

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
 };

 if (!isOpen) return null;

 const isAtivo = formData.tipo === 'Ativo';
 const contasFiltradas = contasPatrimoniais.filter(c =>
 isAtivo ? c.tipo === 'Conta de Ativo' : c.tipo === 'Conta de Passivo'
 );
 const categsFiltradas = categorias.filter(c => c.tipo === formData.tipo);

 return (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
 <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">

 {/* Header azul padrão do Design System */}
 <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
 <h3 className="text-base font-bold flex items-center gap-2">
 <FontAwesomeIcon icon={isAtivo ? faChartLine : faChartBar} />
 {isEditing ? `Editar ${formData.tipo}` : 'Registrar Patrimônio'}
 </h3>
 <button onClick={onClose} title="Fechar"
 className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
 <FontAwesomeIcon icon={faTimes} />
 </button>
 </div>

 <form onSubmit={handleSubmit}>
 <div className="p-6 space-y-5">

 {/* Tipo — Ativo ou Passivo */}
 {!isEditing && (
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Natureza</label>
 <div className="flex gap-3">
 <button type="button"
 onClick={() => setFormData(prev => ({ ...prev, tipo: 'Ativo', conta_id: '' }))}
 className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-bold border-2 text-sm transition-all ${formData.tipo === 'Ativo'
 ? 'bg-green-600 text-white border-green-600'
 : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
 }`}>
 <FontAwesomeIcon icon={faChartLine} /> Ativo (Bem/Direito)
 </button>
 <button type="button"
 onClick={() => setFormData(prev => ({ ...prev, tipo: 'Passivo', conta_id: '' }))}
 className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-bold border-2 text-sm transition-all ${formData.tipo === 'Passivo'
 ? 'bg-red-600 text-white border-red-600'
 : 'bg-white text-gray-500 border-gray-200 hover:border-red-300'
 }`}>
 <FontAwesomeIcon icon={faChartBar} /> Passivo (Dívida)
 </button>
 </div>
 </div>
 )}

 {/* Conta Patrimonial */}
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
 Conta {isAtivo ? 'de Ativo' : 'de Passivo'} *
 </label>
 <select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
 <option value="">— Selecione a conta —</option>
 {contasFiltradas.map(c => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 {contasFiltradas.length === 0 && (
 <option disabled>Nenhuma conta de {formData.tipo} cadastrada</option>
 )}
 </select>
 </div>

 {/* Descrição */}
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Descrição *</label>
 <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} required
 placeholder={isAtivo ? 'Ex: Computadores adquiridos, Lote em permuta...' : 'Ex: Empréstimo CEF, Financiamento...'}
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-400" />
 </div>

 <div className="grid grid-cols-2 gap-4">
 {/* Valor */}
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Valor *</label>
 <IMaskInput
 mask="R$ num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } }}
 unmask={true}
 value={String(formData.valor || '')}
 onAccept={(value) => setFormData(prev => ({ ...prev, valor: value }))}
 required
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
 />
 </div>
 {/* Data */}
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data de Registro</label>
 <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange}
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
 </div>
 </div>

 {/* Categoria */}
 {categsFiltradas.length > 0 && (
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Categoria</label>
 <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange}
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
 <option value="">Sem categoria</option>
 {categsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
 </select>
 </div>
 )}

 {/* Observações */}
 <div>
 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Observações</label>
 <textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows="2"
 placeholder="Detalhes adicionais..."
 className="w-full p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors resize-none" />
 </div>
 </div>

 {/* Rodapé */}
 <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
 <button type="button" onClick={onClose}
 className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
 Cancelar
 </button>
 <button type="submit" disabled={mutation.isPending}
 className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
 <FontAwesomeIcon icon={mutation.isPending ? faSpinner : faSave} spin={mutation.isPending} />
 {mutation.isPending ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : `Registrar ${formData.tipo}`)}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
