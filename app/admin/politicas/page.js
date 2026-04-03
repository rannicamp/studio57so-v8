"use client";

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCheckCircle, faFileAlt, faSpinner, faWarning, faUpload } from '@fortawesome/free-solid-svg-icons';

export default function GestaoPoliticasPage() {
 const supabase = createClient();
 const queryClient = useQueryClient();

 const [isCreating, setIsCreating] = useState(false);
 const [submitAction, setSubmitAction] = useState('publish');
 const [formData, setFormData] = useState({ tipo: 'termos_uso', versao: '', titulo: '', conteudo: '' });

 // Buscar políticas (Ordenadas das mais novas pras mais antigas, mostrando ativas no topo)
 const { data: politicas, isLoading } = useQuery({
 queryKey: ['politicas_admin'],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('politicas_plataforma')
 .select('*')
 .order('is_active', { ascending: false })
 .order('data_publicacao', { ascending: false });

 if (error) throw error;
 return data || [];
 }
 });

 const createPolicyMutation = useMutation({
 mutationFn: async (payload) => {
 const { publishNow, ...insertData } = payload;

 if (publishNow) {
 // Se for ativar uma nova política, as antigas do mesmo tipo perdem a coroa
 await supabase
 .from('politicas_plataforma')
 .update({ is_active: false })
 .eq('tipo', insertData.tipo);
 }

 // Insere a nova política com is_active: publishNow
 const { data, error } = await supabase
 .from('politicas_plataforma')
 .insert([{ ...insertData, is_active: publishNow }])
 .select()
 .single();

 if (error) throw error;
 return { data, publishNow };
 },
 onSuccess: ({ publishNow }) => {
 toast.success(publishNow ? "Nova política publicada e ativada com sucesso!" : "Rascunho salvo com sucesso!");
 queryClient.invalidateQueries(['politicas_admin']);
 setFormData({ tipo: 'termos_uso', versao: '', titulo: '', conteudo: '' });
 setIsCreating(false);
 },
 onError: (err) => {
 toast.error(`Falha ao salvar política: ${err.message}`);
 }
 });

 const publishDraftMutation = useMutation({
 mutationFn: async ({ id, tipo }) => {
 // Desativa todas do mesmo tipo
 await supabase.from('politicas_plataforma').update({ is_active: false }).eq('tipo', tipo);
 // Ativa a que foi clicada
 const { error } = await supabase.from('politicas_plataforma').update({ is_active: true }).eq('id', id);

 if (error) throw error;
 return true;
 },
 onSuccess: () => {
 toast.success("Política Publicada! O bloqueio de sistema já está ativo para os clientes.");
 queryClient.invalidateQueries(['politicas_admin']);
 },
 onError: (err) => {
 toast.error(`Erro ao publicar rascunho: ${err.message}`);
 }
 });

 const handleCreate = (e) => {
 e.preventDefault();
 if (!formData.versao.includes('v') && !formData.versao.includes('V')) {
 return toast.error("A versão deve seguir o padrão: v1.0, v2.1, etc.");
 }
 createPolicyMutation.mutate({ ...formData, publishNow: submitAction === 'publish' });
 };

 return (
 <div className="space-y-6 max-w-5xl mx-auto">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white tracking-tight">Compliance & Políticas</h1>
 <p className="text-slate-400 text-sm mt-1">Gerencie os Termos de Uso e evite litígios legais.</p>
 </div>
 {!isCreating && (
 <button onClick={() => setIsCreating(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
 <FontAwesomeIcon icon={faPlus} /> Nova Versão
 </button>
 )}
 </div>

 {/* Criador de Documentos */}
 {isCreating && (
 <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl animate-fade-in relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>
 <h2 className="text-lg font-semibold text-white mb-4 border-b border-slate-800 pb-2">Publicar Nova Política</h2>

 <form onSubmit={handleCreate} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Documento</label>
 <select
 value={formData.tipo}
 onChange={e => setFormData({ ...formData, tipo: e.target.value })}
 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
 >
 <option value="termos_uso">Termos de Uso</option>
 <option value="privacidade">Política de Privacidade</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-300 mb-1">Versão (ex: v1.0)</label>
 <input
 required
 type="text"
 placeholder="v1.0"
 value={formData.versao}
 onChange={e => setFormData({ ...formData, versao: e.target.value })}
 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-300 mb-1">Título Público</label>
 <input
 required
 type="text"
 placeholder="Termos de Contratação do Studio 57"
 value={formData.titulo}
 onChange={e => setFormData({ ...formData, titulo: e.target.value })}
 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-300 mb-1">Conteúdo Legal (Regras)</label>
 <textarea
 required
 rows={12}
 placeholder="Digite todo o documento legal aqui. Use parágrafos e pontuações claras..."
 value={formData.conteudo}
 onChange={e => setFormData({ ...formData, conteudo: e.target.value })}
 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 resize-y"
 ></textarea>
 </div>

 <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 text-sm text-yellow-200/80">
 <FontAwesomeIcon icon={faWarning} className="mt-0.5 text-yellow-500" />
 <p><strong>Atenção:</strong> Ao clicar em publicar, esta versão passará a ser a <strong className="text-yellow-400">ativa</strong> e as anteriores serão revogadas. Os clientes que ainda não assinaram esta nova versão terão a tela bloqueada na plataforma exigindo o aceite.</p>
 </div>

 <div className="flex items-center justify-end gap-3 pt-2">
 <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-300 font-medium transition-colors">Cancelar</button>
 <button type="submit" onClick={() => setSubmitAction('draft')} disabled={createPolicyMutation.isPending} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 border border-slate-700">
 {createPolicyMutation.isPending && submitAction === 'draft' ? <FontAwesomeIcon icon={faSpinner} spin /> : "Salvar Rascunho"}
 </button>
 <button type="submit" onClick={() => setSubmitAction('publish')} disabled={createPolicyMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
 {createPolicyMutation.isPending && submitAction === 'publish' ? <FontAwesomeIcon icon={faSpinner} spin /> : "Publicar Edital / Política"}
 </button>
 </div>
 </form>
 </div>
 )}

 {/* Listagem do que já existe */}
 <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
 <div className="p-5 border-b border-slate-800 bg-slate-900/50">
 <h3 className="font-medium text-slate-200">Histórico de Políticas</h3>
 </div>

 {isLoading ? (
 <div className="p-8 text-center text-slate-500"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</div>
 ) : politicas?.length === 0 ? (
 <div className="p-10 text-center flex flex-col items-center justify-center">
 <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-3">
 <FontAwesomeIcon icon={faFileAlt} className="text-2xl text-slate-600" />
 </div>
 <p className="text-slate-400 font-medium">Nenhum documento legal encontrado.</p>
 <p className="text-slate-500 text-sm mt-1">Clique em "Nova Versão" para criar os termos de uso.</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-800">
 {politicas.map((pol) => (
 <div key={pol.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
 <div>
 <div className="flex items-center gap-3 mb-1">
 <h4 className="font-semibold text-slate-200">{pol.titulo || 'Termos de Uso'}</h4>
 <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-md border border-slate-700 font-mono">{pol.versao}</span>
 {pol.is_active ? (
 <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5 font-medium border border-emerald-500/20">
 <FontAwesomeIcon icon={faCheckCircle} /> Vigente (Ativa)
 </span>
 ) : (
 <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5 font-medium border border-slate-700">
 Inativa / Rascunho
 </span>
 )}
 </div>
 <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
 <span>Tipo: <strong className="text-slate-400 uppercase">{pol.tipo}</strong></span>
 <span>Publicado em: {new Date(pol.data_publicacao).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {!pol.is_active && (
 <button
 onClick={() => publishDraftMutation.mutate({ id: pol.id, tipo: pol.tipo })}
 disabled={publishDraftMutation.isPending}
 className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium px-3 py-1.5 rounded-md border border-emerald-500/30 transition-colors flex items-center gap-2"
 title="Ativar esta versão e bloquear os clientes que ainda não a assinaram."
 >
 {publishDraftMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faUpload} /> Publicar</>}
 </button>
 )}
 <button className="text-slate-400 hover:text-slate-200 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors flex-shrink-0">
 Ler Texto
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}
