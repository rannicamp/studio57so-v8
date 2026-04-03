"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronDown, faChevronUp, faTrash, faSave, faSpinner, faClock } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const JornadaForm = ({ jornada, onSave, onDelete }) => {
 const supabase = createClient();
 const [isExpanded, setIsExpanded] = useState(false);
 const [formData, setFormData] = useState(jornada);

 const handleHeaderChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
 const handleDetailChange = (dia, field, value) => {
 const detalhes = formData.detalhes.map(d => d.dia_semana === dia ? { ...d, [field]: value || null } : d);
 setFormData(prev => ({ ...prev, detalhes }));
 };

 const handleSave = async () => {
 const promise = async () => {
 const { id, nome_jornada, carga_horaria_semanal, tolerancia_minutos, organizacao_id } = formData;

 // Por que: Adicionamos o filtro de organizacao_id para garantir que o usuário só possa editar uma jornada da sua própria organização.
 const { error: jornadaError } = await supabase.from('jornadas').update({ nome_jornada, carga_horaria_semanal, tolerancia_minutos }).eq('id', id).eq('organizacao_id', organizacao_id);
 if (jornadaError) throw new Error(`Erro ao salvar jornada: ${jornadaError.message}`);

 const { error: detalhesError } = await supabase.from('jornada_detalhes').upsert(formData.detalhes.map(({ id, ...rest }) => rest), { onConflict: 'jornada_id, dia_semana' });
 if (detalhesError) throw new Error(`Erro ao salvar detalhes: ${detalhesError.message}`);

 return formData;
 };

 toast.promise(promise(), {
 loading: 'Salvando jornada...',
 success: (updatedData) => {
 onSave(updatedData);
 return 'Jornada salva com sucesso!';
 },
 error: (err) => err.message
 });
 };

 const handleDelete = () => {
 // Por que: Substituímos o window.confirm por um toast de confirmação mais moderno.
 toast.warning(`Tem certeza que deseja excluir a jornada "${formData.nome_jornada}"?`, {
 action: {
 label: "Confirmar Exclusão",
 onClick: () => onDelete(formData.id)
 },
 cancel: {
 label: "Cancelar"
 }
 });
 };

 return (
 <div className="bg-white border border-gray-100 rounded-[2rem] mb-6 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
 <div
 className={`p-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50/80 border-b border-gray-100' : 'hover:bg-gray-50'}`}
 onClick={() => setIsExpanded(!isExpanded)}
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
 <FontAwesomeIcon icon={faClock} className={isExpanded ? 'animate-pulse' : ''} />
 </div>
 <div>
 <h3 className="font-extrabold text-lg text-gray-800 tracking-tight">{formData.nome_jornada}</h3>
 <p className="text-sm font-medium text-gray-500">{formData.carga_horaria_semanal}h Semanais</p>
 </div>
 </div>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-gray-100 text-gray-400'}`}>
 <FontAwesomeIcon icon={faChevronDown} />
 </div>
 </div>
 {isExpanded && (
 <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-300">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 backdrop-blur-sm">
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Nome da Jornada</label>
 <input value={formData.nome_jornada} onChange={e => handleHeaderChange('nome_jornada', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-inner focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-gray-300" />
 </div>
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Carga Semanal (h)</label>
 <input type="number" value={formData.carga_horaria_semanal} onChange={e => handleHeaderChange('carga_horaria_semanal', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-inner focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-gray-300" />
 </div>
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Tolerância (Minutos)</label>
 <input type="number" value={formData.tolerancia_minutos} onChange={e => handleHeaderChange('tolerancia_minutos', e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 shadow-inner focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-gray-300" />
 </div>
 </div>

 <div className="overflow-x-auto custom-scrollbar border border-gray-100 rounded-2xl shadow-sm">
 <table className="min-w-full divide-y divide-gray-100">
 <thead className="bg-gray-50/80">
 <tr>
 <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 uppercase tracking-widest border-b border-gray-200/60 w-32">Dia da Semana</th>
 <th className="px-4 py-4 text-center text-[11px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-l border-gray-200/60 bg-blue-50/30">Entrada</th>
 <th className="px-4 py-4 text-center text-[11px] font-extrabold text-amber-600 uppercase tracking-widest border-b border-l border-gray-200/60 bg-amber-50/30">Início Repouso</th>
 <th className="px-4 py-4 text-center text-[11px] font-extrabold text-emerald-600 uppercase tracking-widest border-b border-l border-gray-200/60 bg-emerald-50/30">Fim Repouso</th>
 <th className="px-4 py-4 text-center text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest border-b border-l border-gray-200/60 bg-indigo-50/30">Saída</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {formData.detalhes.filter(d => d.dia_semana > 0 && d.dia_semana < 6).sort((a, b) => a.dia_semana - b.dia_semana).map((d, index) => (
 <tr key={d.dia_semana} className="group hover:bg-gray-50/50 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap font-extrabold text-sm text-gray-700">{weekDays[d.dia_semana]}</td>
 <td className="px-2 py-3 border-l border-gray-50"><input type="time" value={d.horario_entrada || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_entrada', e.target.value)} className="w-full text-center bg-gray-50/50 border border-transparent group-hover:bg-white group-hover:border-blue-200 rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all" /></td>
 <td className="px-2 py-3 border-l border-gray-50"><input type="time" value={d.horario_saida_intervalo || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_saida_intervalo', e.target.value)} className="w-full text-center bg-gray-50/50 border border-transparent group-hover:bg-white group-hover:border-amber-200 rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-amber-100 outline-none transition-all" /></td>
 <td className="px-2 py-3 border-l border-gray-50"><input type="time" value={d.horario_volta_intervalo || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_volta_intervalo', e.target.value)} className="w-full text-center bg-gray-50/50 border border-transparent group-hover:bg-white group-hover:border-emerald-200 rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" /></td>
 <td className="px-2 py-3 border-l border-gray-50"><input type="time" value={d.horario_saida || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_saida', e.target.value)} className="w-full text-center bg-gray-50/50 border border-transparent group-hover:bg-white group-hover:border-indigo-200 rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" /></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
 <div>
 <label className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest">Regra de Fim de Semana</label>
 <p className="text-sm font-medium text-indigo-600/80 mt-1">Como padrão, qualquer registro e hora prestada em finais de semana ou feriados conta com multiplicador de 100% como Hora Extra.</p>
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
 <button onClick={handleDelete} className="px-6 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all flex items-center gap-2 active:scale-95"><FontAwesomeIcon icon={faTrash} /> Excluir</button>
 <button onClick={handleSave} className="px-8 py-2.5 rounded-xl text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2 active:translate-y-0 focus:outline-none"><FontAwesomeIcon icon={faSave} /> Salvar Regras</button>
 </div>
 </div>
 )}
 </div>
 );
};

export default function JornadaManager({ initialJornadas }) {
 const supabase = createClient();
 const { userData } = useAuth();
 const [jornadas, setJornadas] = useState(initialJornadas);

 const handleAddNewJornada = async () => {
 // Por que: Substituímos o prompt por um formulário dentro de um toast, uma UX muito superior.
 const AddJornadaForm = ({ toastId }) => {
 const [nome, setNome] = useState('');
 const handleSubmit = (e) => {
 e.preventDefault();
 if (!nome.trim()) {
 toast.error("O nome da jornada não pode ser vazio.");
 return;
 }
 toast.dismiss(toastId); // Fecha o toast com o formulário
 createNewJornada(nome.trim());
 };
 return (
 <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
 <label className="font-semibold">Nome da nova jornada:</label>
 <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="p-2 border rounded" autoFocus />
 <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Criar Jornada</button>
 </form>
 );
 };
 toast.custom((t) => <AddJornadaForm toastId={t} />, { duration: Infinity }); // Mantém o toast aberto
 };

 const createNewJornada = (nome) => {
 const promise = async () => {
 const orgId = userData?.organizacao_id;
 if (!orgId) throw new Error("Organização não encontrada. Faça login novamente.");

 // Por que: Adicionamos o organizacao_id para garantir que a nova jornada seja criada na organização correta.
 const { data: newJornada, error } = await supabase.from('jornadas').insert({
 nome_jornada: nome,
 carga_horaria_semanal: 44,
 tolerancia_minutos: 5,
 organizacao_id: orgId
 }).select().single();

 if (error) throw error;

 const detalhes = weekDays.map((_, i) => ({ jornada_id: newJornada.id, dia_semana: i }));
 const { error: detalhesError } = await supabase.from('jornada_detalhes').insert(detalhes);
 if (detalhesError) throw new Error(`Jornada criada, mas houve um erro nos detalhes: ${detalhesError.message}`);

 return { ...newJornada, detalhes };
 };

 toast.promise(promise(), {
 loading: 'Criando nova jornada...',
 success: (novaJornadaComDetalhes) => {
 setJornadas(prev => [...prev, novaJornadaComDetalhes].sort((a, b) => a.nome_jornada.localeCompare(b.nome_jornada)));
 return 'Jornada criada com sucesso!';
 },
 error: (err) => err.message
 });
 };

 const handleDeleteJornada = async (id) => {
 const promise = async () => {
 const orgId = userData?.organizacao_id;
 if (!orgId) throw new Error("Organização não encontrada.");

 // Por que: Adicionamos o filtro de organizacao_id para garantir que um usuário só possa excluir jornadas da sua própria organização.
 const { error } = await supabase.from('jornadas').delete().eq('id', id).eq('organizacao_id', orgId);
 if (error) throw error;
 };

 toast.promise(promise(), {
 loading: 'Excluindo jornada...',
 success: () => {
 setJornadas(prev => prev.filter(j => j.id !== id));
 return 'Jornada excluída com sucesso!';
 },
 error: (err) => `Erro ao excluir: ${err.message}`
 });
 };

 const handleUpdateJornadaState = (updated) => setJornadas(prev => prev.map(j => j.id === updated.id ? updated : j));

 return (
 <div className="space-y-6 w-full">
 <div className="flex justify-end w-full">
 <button
 onClick={handleAddNewJornada}
 className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
 >
 <FontAwesomeIcon icon={faPlus} /> Nova Jornada
 </button>
 </div>

 <div className="space-y-4">
 {jornadas.length > 0 ? jornadas.map(j => (
 <JornadaForm key={j.id} jornada={j} onSave={handleUpdateJornadaState} onDelete={handleDeleteJornada} />
 )) : (
 <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
 <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex mx-auto items-center justify-center mb-4 shadow-sm transition-transform hover:scale-105">
 <FontAwesomeIcon icon={faClock} className="text-gray-300 text-xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum Horário Padrão Registrado</h3>
 <p className="text-xs font-medium text-gray-400 max-w-sm mx-auto">Sua organização ainda não possui jornadas configuradas. Elas são a base do cálculo do ponto para faltas e horas extras.</p>
 </div>
 )}
 </div>
 </div>
 );
}