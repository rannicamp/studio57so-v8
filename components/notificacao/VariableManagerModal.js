"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faLink, faTimes, faArrowDown, faSpinner, faSave, faList, faPlus, faTrash, faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';

// REMOVIDO: usePersistentState causava travamento ao trocar de contexto
// import { usePersistentState } from '@/hooks/usePersistentState';

export default function VariableManagerModal({ isOpen, onClose, tabelaGatilho, tabelas, campos }) {
 const supabase = createClient();
 const queryClient = useQueryClient();

 // Controle de Abas: 'list' ou 'create'
 const [activeTab, setActiveTab] = useState('list');

 // DEVONILDO FIX: Usando useState normal para garantir que o formulário limpe ao mudar de tabela
 const [formData, setFormData] = useState({
 tabela_gatilho: tabelaGatilho || '',
 coluna_origem: '',
 tabela_destino: '',
 coluna_chave_destino: 'id',
 coluna_retorno: '',
 nome_variavel: ''
 });

 // DEVONILDO FIX: Reset completo quando a tabela gatilho muda
 useEffect(() => {
 if (tabelaGatilho) {
 setFormData({
 tabela_gatilho: tabelaGatilho,
 coluna_origem: '',
 tabela_destino: '',
 coluna_chave_destino: 'id',
 coluna_retorno: '',
 nome_variavel: ''
 });
 // Sempre volta para a lista ao abrir em uma nova tabela
 setActiveTab('list');
 }
 }, [tabelaGatilho]); // Removida dependência de setFormData para evitar loops

 // --- QUERY: Buscar Variáveis Existentes ---
 const { data: variaveisExistentes = [], isLoading: isLoadingList } = useQuery({
 queryKey: ['variaveis_virtuais', tabelaGatilho],
 queryFn: async () => {
 if (!tabelaGatilho) return [];
 const { data, error } = await supabase
 .from('variaveis_virtuais')
 .select('*')
 .eq('tabela_gatilho', tabelaGatilho)
 .order('created_at', { ascending: false });
 if (error) throw error;
 return data;
 },
 enabled: isOpen && !!tabelaGatilho
 });

 // --- MUTATION: Criar ---
 const createMutation = useMutation({
 mutationFn: async (dados) => {
 const { data: { user } } = await supabase.auth.getUser();

 // Busca organização com segurança
 const { data: userData, error: userError } = await supabase
 .from('usuarios')
 .select('organizacao_id')
 .eq('id', user.id)
 .single();

 if (userError || !userData) throw new Error("Erro ao identificar organização do usuário.");

 const { error } = await supabase.from('variaveis_virtuais').insert({
 ...dados,
 organizacao_id: userData.organizacao_id
 });
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Variável criada com sucesso!");
 queryClient.invalidateQueries(['variaveis_virtuais']);

 // Limpa campos específicos e volta pra lista
 setFormData(prev => ({
 ...prev,
 nome_variavel: '',
 coluna_retorno: '',
 // Mantém a origem e destino para facilitar criações em massa se quiser
 }));
 setActiveTab('list');
 },
 onError: (err) => toast.error("Erro ao criar: " + err.message)
 });

 // --- MUTATION: Deletar ---
 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 const { error } = await supabase.from('variaveis_virtuais').delete().eq('id', id);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Variável removida.");
 queryClient.invalidateQueries(['variaveis_virtuais']);
 },
 onError: (err) => toast.error("Erro ao deletar: " + err.message)
 });

 // --- Dados Computados para o Form (Com proteção contra undefined) ---
 const colunasOrigem = useMemo(() => {
 if (!tabelas || !campos) return [];
 const tab = tabelas.find(t => t.nome_tabela === formData.tabela_gatilho);
 return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
 }, [formData.tabela_gatilho, tabelas, campos]);

 const colunasDestino = useMemo(() => {
 if (!tabelas || !campos) return [];
 const tab = tabelas.find(t => t.nome_tabela === formData.tabela_destino);
 return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
 }, [formData.tabela_destino, tabelas, campos]);

 const handleSave = () => {
 if (!formData.coluna_origem || !formData.tabela_destino || !formData.coluna_retorno || !formData.nome_variavel) {
 toast.error("Por favor, preencha todos os campos do link.");
 return;
 }
 createMutation.mutate(formData);
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100/50 flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200">

 {/* HEADER */}
 <div className="bg-blue-600 text-white to-indigo-600 p-6 flex justify-between items-center text-white shrink-0 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
 <div className="absolute bottom-0 left-20 w-24 h-24 bg-indigo-400/20 rounded-full blur-xl -mb-10"></div>

 <div className="relative z-10">
 <h3 className="text-lg font-extrabold flex items-center gap-3 tracking-wide">
 <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
 <FontAwesomeIcon icon={faLink} className="text-white" />
 </div>
 Variáveis Virtuais
 </h3>
 <p className="text-purple-100 text-xs mt-1 font-medium flex items-center gap-2">
 Módulo base:
 <span className="bg-white/20 text-white px-2 py-0.5 rounded-md font-mono font-bold tracking-wider">
 {tabelaGatilho || 'Geral'}
 </span>
 </p>
 </div>
 <button onClick={onClose} className="relative z-10 hover:bg-white/20 text-white/80 hover:text-white p-2 rounded-xl w-10 h-10 flex items-center justify-center transition-all bg-white/10 backdrop-blur-sm">
 <FontAwesomeIcon icon={faTimes} className="text-lg" />
 </button>
 </div>

 {/* TABS */}
 <div className="flex border-b border-gray-100 shrink-0 bg-gray-50/50 p-2 pb-0">
 <button
 onClick={() => setActiveTab('list')}
 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all rounded-t-xl relative ${activeTab === 'list' ? 'text-purple-700 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pt-4 pb-3' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`}
 >
 <FontAwesomeIcon icon={faList} className={activeTab === 'list' ? 'text-purple-500' : ''} />
 Minhas Variáveis
 {activeTab === 'list' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-500 rounded-b-full"></div>}
 </button>
 <button
 onClick={() => setActiveTab('create')}
 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all rounded-t-xl relative ${activeTab === 'create' ? 'text-purple-700 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pt-4 pb-3' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`}
 >
 <FontAwesomeIcon icon={faPlus} className={activeTab === 'create' ? 'text-purple-500' : ''} />
 Nova Conexão
 {activeTab === 'create' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-500 rounded-b-full"></div>}
 </button>
 </div>

 {/* CONTENT AREA */}
 <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">

 {/* --- VIEW: LISTA --- */}
 {activeTab === 'list' && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 {isLoadingList ? (
 <div className="text-center py-12 text-purple-400 bg-purple-50/30 rounded-2xl border border-purple-100 flex flex-col items-center justify-center gap-3">
 <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-purple-500" />
 <span className="font-bold text-sm tracking-widest uppercase">Buscando conexões...</span>
 </div>
 ) : variaveisExistentes.length === 0 ? (
 <div className="text-center py-16 px-6 border-2 border-dashed border-purple-200/50 rounded-2xl bg-purple-50/20 flex flex-col items-center justify-center group hover:bg-purple-50/50 hover:border-purple-300 transition-all cursor-pointer" onClick={() => setActiveTab('create')}>
 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
 <FontAwesomeIcon icon={faLink} className="text-2xl text-purple-300" />
 </div>
 <h4 className="font-extrabold text-gray-700 text-lg mb-1">Nenhuma Conexão</h4>
 <p className="text-gray-400 text-sm max-w-sm mx-auto mb-4">Você ainda não conectou nenhuma variável externa a esta tabela base.</p>
 <button className="text-purple-600 font-bold bg-white px-5 py-2.5 rounded-xl shadow-sm border border-purple-100 hover:bg-purple-600 hover:text-white transition-all active:scale-95">
 Criar Primeira Conexão
 </button>
 </div>
 ) : (
 <div className="grid gap-4">
 {variaveisExistentes.map((item) => (
 <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 group hover:border-purple-300 hover:shadow-md transition-all relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-purple-100 group-hover:bg-purple-500 transition-colors"></div>
 <div className="pl-3">
 <div className="flex flex-wrap items-center gap-3 mb-2">
 <span className="font-mono font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg text-sm border border-purple-100 shadow-inner">
 {`{${item.nome_variavel}}`}
 </span>
 <div className="bg-gray-100 text-gray-400 w-6 h-6 flex items-center justify-center rounded-full shadow-sm text-[10px]">
 <FontAwesomeIcon icon={faExchangeAlt} />
 </div>
 <span className="text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
 {item.tabela_destino} <strong className="text-gray-400">.</strong> {item.coluna_retorno}
 </span>
 </div>
 <p className="text-[11px] text-gray-400 flex items-center gap-1.5 font-medium ml-1">
 Ligação exata:
 <span className="text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">{item.coluna_origem}</span>
 <FontAwesomeIcon icon={faArrowDown} className="-rotate-90 text-[10px] text-gray-300" />
 <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.coluna_chave_destino}</span>
 </p>
 </div>
 <button
 onClick={() => { if (confirm('Excluir esta variável conectada? A ação é irreversível.')) deleteMutation.mutate(item.id) }}
 className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 bg-gray-50 border border-gray-100 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
 title="Apagar Conexão permanentemente"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* --- VIEW: CRIAÇÃO --- */}
 {activeTab === 'create' && (
 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
 <div className="flex items-start gap-3 bg-purple-50/80 p-4 rounded-xl border border-purple-100">
 <div className="bg-white p-2 rounded-lg text-purple-500 shadow-sm shrink-0">
 <FontAwesomeIcon icon={faLink} />
 </div>
 <p className="text-xs text-purple-800 font-medium leading-relaxed">
 Crie links virtuais para acessar dados de <strong>outras tabelas</strong> a partir da tabela atual.
 Excelente para puxar nomes de clientes, emails de responsáveis, etc.
 </p>
 </div>

 <div className="space-y-6 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-600 before:text-white before: before:to-transparent pl-12">
 {/* PASSO 1: ORIGEM */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative">
 <div className="absolute -left-12 top-2 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm z-10">1</div>

 <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-16 h-16 bg-gray-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-125"></div>
 <label className="block text-[10px] font-extrabold text-gray-400 tracking-widest uppercase mb-2">Onde estamos</label>
 <div className="flex items-center gap-2">
 <span className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
 <FontAwesomeIcon icon={faList} className="text-xs" />
 </span>
 <div className="text-sm font-bold text-gray-700">
 {formData.tabela_gatilho || 'Nenhuma base selecionada'}
 </div>
 </div>
 </div>

 <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
 <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-125"></div>
 <label className="block text-[10px] font-extrabold text-purple-600 tracking-widest uppercase mb-2">Usar qual campo daqui?</label>
 <select
 className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 outline-none transition-all cursor-pointer"
 value={formData.coluna_origem}
 onChange={e => setFormData({ ...formData, coluna_origem: e.target.value })}
 >
 <option value="">Selecione a chave (ex: cliente_id)</option>
 {colunasOrigem.map(c => <option key={c.id} value={c.nome_coluna}>{c.nome_coluna}</option>)}
 </select>
 </div>
 </div>

 {/* PASSO 2: DESTINO */}
 <div className="bg-blue-600 text-white to-white p-5 rounded-3xl border border-gray-200 shadow-sm relative mt-2">
 <div className="absolute -left-12 top-6 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm z-10">2</div>

 <div className="mb-5">
 <label className="block text-[10px] font-extrabold text-indigo-500 tracking-widest uppercase mb-2">Para encontrar em qual tabela?</label>
 <select
 className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm cursor-pointer"
 value={formData.tabela_destino}
 onChange={e => setFormData({ ...formData, tabela_destino: e.target.value })}
 >
 <option value="">Selecione o destino...</option>
 {tabelas.map(t => <option key={t.id} value={t.nome_tabela}>{t.nome_exibicao} ({t.nome_tabela})</option>)}
 </select>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-gray-100">
 <div>
 <label className="block text-[10px] font-extrabold text-gray-400 tracking-widest uppercase mb-2">Combinar com</label>
 <input
 className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-500 focus:bg-white focus:border-gray-300 outline-none transition-all"
 value={formData.coluna_chave_destino}
 onChange={e => setFormData({ ...formData, coluna_chave_destino: e.target.value })}
 placeholder="Geralmente 'id'"
 />
 </div>
 <div className="relative">
 <label className="block text-[10px] font-extrabold text-green-600 tracking-widest uppercase mb-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> E Trazer a Coluna</label>
 <select
 className="w-full px-4 py-2.5 bg-green-50/50 border border-green-200 rounded-xl text-sm font-bold text-green-800 focus:bg-white focus:border-green-400 focus:ring-4 focus:ring-green-100 outline-none transition-all shadow-sm cursor-pointer"
 value={formData.coluna_retorno}
 onChange={e => setFormData({ ...formData, coluna_retorno: e.target.value })}
 >
 <option value="">Retornar qual dado?</option>
 {colunasDestino.map(c => <option key={c.id} value={c.nome_coluna}>{c.nome_coluna}</option>)}
 </select>
 </div>
 </div>
 </div>

 {/* PASSO 3: NOME DA VARIÁVEL */}
 <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative mt-2 group focus-within:border-purple-200 focus-within:ring-4 focus-within:ring-purple-50 transition-all">
 <div className="absolute -left-12 top-6 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm z-10">3</div>
 <label className="block text-[10px] font-extrabold text-gray-500 tracking-widest uppercase mb-3">Apelido (Nome da Nova Variável)</label>
 <div className="relative flex items-center">
 <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-50 border-r border-gray-200 rounded-l-xl flex items-center justify-center font-bold text-gray-400 text-lg">
 {'{'}
 </div>
 <input
 className="w-full pl-16 pr-12 py-3 bg-white border border-gray-200 rounded-xl font-mono font-bold text-lg text-purple-700 outline-none placeholder-gray-300"
 value={formData.nome_variavel}
 onChange={e => setFormData({ ...formData, nome_variavel: e.target.value.replace(/[{}]/g, '').toLowerCase().replace(/\s/g, '_') })}
 placeholder="ex: dono_tarefa"
 />
 <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center font-bold text-gray-400 text-lg">
 {'}'}
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* FOOTER */}
 <div className="p-5 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
 <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all active:scale-95 shadow-sm">
 Fechar
 </button>

 {activeTab === 'create' && (
 <button
 onClick={handleSave}
 disabled={createMutation.isPending || !formData.coluna_origem || !formData.tabela_destino || !formData.nome_variavel}
 className="px-8 py-2.5 text-sm font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-[0_4px_14px_0_rgba(147,51,234,0.39)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.23)] flex items-center gap-3 disabled:opacity-50 disabled:shadow-none transition-all transform hover:-translate-y-0.5 active:translate-y-0"
 >
 {createMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="text-lg" /> : <FontAwesomeIcon icon={faSave} className="text-lg" />}
 Gerar Variável
 </button>
 )}
 </div>
 </div>
 </div>
 );
}