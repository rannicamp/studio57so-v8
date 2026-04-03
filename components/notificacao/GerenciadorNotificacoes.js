"use client";

import { useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faPlus, faEdit, faTrash, faBolt, faSpinner, faMobileAlt, faSync,
 faTable, faCopy, faRobot
} from '@fortawesome/free-solid-svg-icons';
import RegraForm from './RegraForm';
import { renderIcon } from './constants';
// Importação do hook de persistência
import { usePersistentState } from '@/hooks/usePersistentState';

export default function GerenciadorNotificacoes() {
 const supabase = createClient();
 const queryClient = useQueryClient();

 // SUBSTITUÍDO useState POR usePersistentState
 // Isso lembra se você estava na tela de edição ou na lista
 const [isEditing, setIsEditing] = usePersistentState('notif_isEditing', false);
 const [editingRule, setEditingRule] = usePersistentState('notif_editingRule', null);

 const { data: regras = [], isLoading } = useQuery({
 queryKey: ['sys_notification_templates'],
 queryFn: async () => {
 const { data, error } = await supabase.from('sys_notification_templates').select('*').order('tabela_alvo', { ascending: true });
 if (error) throw error;
 return data;
 }
 });

 // 2. BUSCA TABELAS DO SISTEMA
 const { data: tabelasSistema = [], isLoading: isLoadingTables } = useQuery({
 queryKey: ['tabelas_sistema'],
 queryFn: async () => {
 const { data, error } = await supabase.from('tabelas_sistema').select('*').eq('ativo', true).order('nome_exibicao');
 if (error) throw error;
 return data;
 }
 });

 // 3. BUSCA CAMPOS (COLUNAS) DO SISTEMA
 const { data: camposSistema = [] } = useQuery({
 queryKey: ['campos_sistema'],
 queryFn: async () => {
 const { data, error } = await supabase.from('campos_sistema').select('*').eq('visivel_filtro', true);
 if (error) throw error;
 return data;
 }
 });

 // 4. BUSCA CARGOS
 const { data: funcoes = [] } = useQuery({
 queryKey: ['funcoes_sistema'],
 queryFn: async () => {
 const { data } = await supabase.from('funcoes').select('id, nome_funcao');
 return data || [];
 }
 });

 // 5. BUSCA VARIÁVEIS VIRTUAIS (LINKS)
 const { data: variaveisVirtuais = [] } = useQuery({
 queryKey: ['variaveis_virtuais'],
 queryFn: async () => {
 try {
 const { data, error } = await supabase.from('variaveis_virtuais').select('*');
 if (error) return [];
 return data;
 } catch (e) {
 return [];
 }
 }
 });

 // Agrupamento para a Lista
 const regrasAgrupadas = useMemo(() => {
 const grupos = {};
 regras.forEach(regra => {
 const infoTabela = tabelasSistema.find(t => t.nome_tabela === regra.tabela_alvo);
 const nomeGrupo = infoTabela ? infoTabela.nome_exibicao : (regra.tabela_alvo || 'Outros');

 if (!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
 grupos[nomeGrupo].push(regra);
 });
 return grupos;
 }, [regras, tabelasSistema]);

 const salvarRegraMutation = useMutation({
 mutationFn: async (dados) => {
 const { id, ...dadosLimpos } = dados;
 // Templates globais são sempre organizacao_id = 1
 const payload = { ...dadosLimpos, organizacao_id: 1 };

 if (editingRule?.id) {
 const { error } = await supabase.from('sys_notification_templates').update(payload).eq('id', editingRule.id);
 if (error) throw error;
 } else {
 const { error } = await supabase.from('sys_notification_templates').insert(payload);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['sys_notification_templates']);
 toast.success(editingRule?.id ? "Template atualizado!" : "Template criado!");
 resetForm();
 },
 onError: (err) => toast.error(`Erro: ${err.message}`)
 });

 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 await supabase.from('sys_notification_templates').delete().eq('id', id);
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['sys_notification_templates']);
 toast.success("Template excluído.");
 }
 });

 const syncTablesMutation = useMutation({
 mutationFn: async () => {
 const { error } = await supabase.rpc('sincronizar_tabelas_do_banco');
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['tabelas_sistema']);
 queryClient.invalidateQueries(['campos_sistema']);
 toast.success("Catálogo de dados atualizado!");
 },
 onError: () => toast.error("Erro ao sincronizar tabelas.")
 });

 const handleEdit = (regra) => {
 setEditingRule(regra);
 setIsEditing(true);
 };

 const handleDuplicate = (regra) => {
 const { id, created_at, organizacao_id, ...copia } = regra;
 const regraDuplicada = { ...copia, nome_regra: `${copia.nome_regra} (Cópia)` };
 setEditingRule(regraDuplicada);
 setIsEditing(true);
 toast.info("Regra duplicada. Ajuste o detalhe e salve.");
 };

 const handleNew = () => {
 setEditingRule(null);
 setIsEditing(true);
 };

 // Reseta o estado persistente ao cancelar/salvar
 const resetForm = () => {
 setIsEditing(false);
 setEditingRule(null);
 // Limpa o form específico também (via sessionStorage ou deixando o componente desmontar e o próximo montar limpo se usarmos chave única)
 localStorage.removeItem('notif_formData');
 };

 const openAIAgent = () => {
 window.open('https://gemini.google.com/gem/1UdcyjP0rRxdtbOjOXbrIYR06nJZnTtGC?usp=sharing', '_blank');
 };

 if (!isEditing) {
 return (
 <div className="space-y-6 h-full flex flex-col p-6 max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 relative animate-in fade-in zoom-in-95 duration-300">
 <div className="flex flex-col md:flex-row justify-between items-center pb-6 border-b border-gray-100 gap-4">
 <div className="flex items-center gap-4 flex-wrap">
 <div className="bg-yellow-50 p-3 rounded-xl text-yellow-500">
 <FontAwesomeIcon icon={faBolt} size="xl" />
 </div>
 <div>
 <h3 className="text-2xl font-bold text-gray-800">
 Regras de Notificação
 </h3>
 <p className="text-sm text-gray-500 mt-1">Gerencie os alertas automáticos do sistema aqui.</p>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
 <button onClick={openAIAgent} className="bg-purple-50 text-purple-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-100 flex items-center gap-2 transition-all" title="Pedir ajuda ao Agente de Notificações">
 <FontAwesomeIcon icon={faRobot} /> Ajuda com IA
 </button>

 <button onClick={() => syncTablesMutation.mutate()} className="bg-gray-50 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border border-gray-100 hover:border-blue-100" title="Buscar novas tabelas e campos do banco">
 <FontAwesomeIcon icon={faSync} spin={syncTablesMutation.isPending} />
 {syncTablesMutation.isPending ? 'Sincronizando...' : 'Atualizar Dados'}
 </button>

 <button onClick={handleNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 shadow-sm shadow-blue-500/30 transition-all">
 <FontAwesomeIcon icon={faPlus} /> Nova Regra
 </button>
 </div>
 </div>

 <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8">
 {isLoading ? (
 <div className="text-center text-gray-400 py-12 flex flex-col items-center justify-center">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500 mb-3" />
 <span className="text-sm font-medium">Carregando motores de notificação...</span>
 </div>
 ) : regras.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-300">
 <div className="bg-gray-50 border border-gray-100 rounded-3xl p-10 max-w-sm w-full mx-auto shadow-sm flex flex-col items-center">
 <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-5 text-gray-300 shadow-sm border border-gray-100">
 <FontAwesomeIcon icon={faBolt} className="text-4xl opacity-80" />
 </div>
 <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma Regra Ativa</h3>
 <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">Você ainda não configurou nenhum alerta ou aviso para sua equipe.</p>
 <button onClick={handleNew} className="px-6 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors">
 Criar Primeira Regra
 </button>
 </div>
 </div>
 ) : (
 Object.keys(regrasAgrupadas).map((grupo) => (
 <div key={grupo} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center gap-3 mb-4 px-2">
 <div className="bg-blue-50/80 p-2 rounded-lg text-blue-600 shadow-sm border border-blue-100/50">
 <FontAwesomeIcon icon={faTable} className="text-sm" />
 </div>
 <h4 className="text-sm font-extrabold text-gray-700 uppercase tracking-widest">
 {grupo}
 </h4>
 <div className="h-px bg-blue-600 text-white to-transparent flex-grow ml-2"></div>
 </div>

 <div className="grid gap-4">
 {regrasAgrupadas[grupo].map((regra) => (
 <div key={regra.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex justify-between items-center group relative overflow-hidden">
 {/* Indicador de Tipo de Evento na Borda */}
 <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>

 <div className="flex items-center gap-5 pl-2">
 <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-sm bg-blue-50 text-blue-600 border border-blue-100/50`}>
 {renderIcon(regra.icone)}
 </div>

 <div>
 <h4 className={`font-bold text-base text-gray-900`}>
 {regra.nome_regra}
 </h4>
 <div className="flex flex-wrap items-center gap-2 mt-2">
 <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${regra.evento === 'INSERT' ? 'bg-green-50 text-green-700 border border-green-200' : regra.evento === 'UPDATE' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
 {regra.evento}
 </span>

 {regra.coluna_monitorada && (
 <span className="text-[11px] bg-yellow-50 text-yellow-800 px-2 py-1 rounded-md border border-yellow-200 flex items-center gap-1">
 se <strong className="font-mono text-yellow-900">{regra.coluna_monitorada}</strong> == {regra.valor_gatilho}
 </span>
 )}

 {/* Mapeando as novas regras avançadas se existirem no objeto root */}
 {regra.regras_avancadas && regra.regras_avancadas.length > 0 && (
 <span className="text-[11px] bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-200 flex items-center gap-1">
 {regra.regras_avancadas.length} Filtro(s) Avançado(s)
 </span>
 )}

 {regra.enviar_para_dono && (
 <span className="text-[11px] bg-blue-600 text-blue-600 px-2 py-1 rounded-md border border-blue-600 flex items-center gap-1" title="Avisa o Criador/Responsável do Registro">
 <FontAwesomeIcon icon={faMobileAlt} /> Sempre Dono
 </span>
 )}
 </div>
 </div>
 </div>

 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
 <button onClick={() => handleDuplicate(regra)} title="Duplicar Regra" className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all">
 <FontAwesomeIcon icon={faCopy} />
 </button>

 <button onClick={() => handleEdit(regra)} title="Editar" className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
 <FontAwesomeIcon icon={faEdit} />
 </button>

 <button onClick={() => { if (confirm('Você tem certeza que quer excluir essa regra para sempre?')) deleteMutation.mutate(regra.id); }} title="Excluir" className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 );
 }

 return (
 <div className="max-w-4xl mx-auto p-6 animate-fade-in">
 <RegraForm
 initialData={editingRule}
 tabelas={tabelasSistema}
 campos={camposSistema}
 funcoes={funcoes}
 variaveisVirtuais={variaveisVirtuais}
 onSubmit={(dados) => salvarRegraMutation.mutate(dados)}
 isSaving={salvarRegraMutation.isPending}
 onCancel={resetForm}
 />
 </div>
 );
}