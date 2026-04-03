// Local do Arquivo: components/configuracoes/CotacoesManager.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartPie, faSave } from '@fortawesome/free-solid-svg-icons';

// ... (o componente CotacaoList já ajustado logo acima)

// Removendo as linhas do CotacaoList para focar no corpo principal // (essa linha serve de quebra no Replacement Chunk)
const CotacaoList = ({ title, items, selectedItems, onToggle, searchTerm, setSearchTerm }) => (
 <div className="flex flex-col bg-white border border-gray-100 shadow-sm rounded-xl h-full overflow-hidden transition-all hover:shadow-md">
 <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col gap-3">
 <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
 {title}
 <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full">{items.length}</span>
 </h3>
 <div className="relative">
 <input
 type="text"
 placeholder={`Pesquisar em ${title.toLowerCase()}...`}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
 />
 </div>
 </div>

 <div className="overflow-y-auto flex-grow p-2 custom-scrollbar">
 {items.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-40 text-center text-gray-400">
 <p className="text-sm">Nenhuma opção encontrada.</p>
 </div>
 ) : (
 <div className="divide-y divide-gray-50">
 {items.map(cotacao => (
 <label key={cotacao.id} htmlFor={cotacao.id} className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors group">
 <span className={`text-sm font-medium transition-colors ${selectedItems.includes(cotacao.id) ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-900'}`}>
 {cotacao.name}
 </span>
 <div className="relative flex-shrink-0 ml-4">
 <input
 type="checkbox"
 id={cotacao.id}
 className="sr-only peer"
 checked={selectedItems.includes(cotacao.id)}
 onChange={() => onToggle(cotacao.id)}
 />
 <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
 </div>
 </label>
 ))}
 </div>
 )}
 </div>
 </div>
);


export default function CotacoesManager({ user }) {
 const supabase = createClient();
 const queryClient = useQueryClient();

 // Estados para as preferências
 const [showBar, setShowBar] = useState(true);
 const [selectedCotacoes, setSelectedCotacoes] = useState([]);

 // Estados para pesquisa
 const [currencySearch, setCurrencySearch] = useState('');
 const [commoditySearch, setCommoditySearch] = useState('');

 // Carrega as configurações do usuário quando o componente é montado
 useEffect(() => {
 if (user) {
 setShowBar(user.mostrar_barra_cotacoes ?? true); // ?? true garante que não seja nulo
 setSelectedCotacoes(user.cotacoes_visiveis || []);
 }
 }, [user]);

 const { data: availableCotacoes, isLoading, isError, error } = useQuery({
 queryKey: ['availableCotacoes'],
 queryFn: () => fetch('/api/cotacoes').then(res => res.json()),
 });

 // Mutação para salvar TODAS as preferências de uma vez
 const mutation = useMutation({
 mutationFn: async (preferences) => {
 const { error } = await supabase
 .from('usuarios')
 .update({
 mostrar_barra_cotacoes: preferences.showBar,
 cotacoes_visiveis: preferences.selectedCotacoes
 })
 .eq('id', user.id);

 if (error) throw new Error(error.message);
 return preferences;
 },
 onSuccess: () => {
 toast.success('Preferências de cotações salvas com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['user'] });
 },
 onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
 });

 const handleToggle = (cotacaoId) => {
 setSelectedCotacoes(prev =>
 prev.includes(cotacaoId) ? prev.filter(id => id !== cotacaoId) : [...prev, cotacaoId]
 );
 };

 const handleSave = () => {
 mutation.mutate({ showBar, selectedCotacoes });
 };

 const { currencies, commodities } = useMemo(() => {
 const filtered = { currencies: [], commodities: [] };
 if (!availableCotacoes) return filtered;
 filtered.currencies = availableCotacoes.filter(c => c.type === 'currency' && c.name.toLowerCase().includes(currencySearch.toLowerCase()));
 filtered.commodities = availableCotacoes.filter(c => c.type === 'commodity' && c.name.toLowerCase().includes(commoditySearch.toLowerCase()));
 return filtered;
 }, [availableCotacoes, currencySearch, commoditySearch]);

 if (isLoading) return (
 <div className="flex flex-col items-center justify-center p-20 min-h-[50vh] text-center animate-in fade-in duration-300">
 <FontAwesomeIcon icon={faSpinner} spin size="3x" className="mb-4 text-blue-500" />
 <p className="text-gray-600 font-medium">Buscando lista de cotações suportadas...</p>
 </div>
 );
 if (isError) return (
 <div className="p-8 text-center bg-red-50 border border-red-100 rounded-xl mt-4 max-w-2xl mx-auto">
 <p className="text-red-600 font-bold mb-2">Erro ao carregar opções</p>
 <p className="text-sm text-red-500">{error.message}</p>
 </div>
 );

 return (
 <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-300">

 <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
 <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
 <FontAwesomeIcon icon={faChartPie} size="xl" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-gray-800">Gerenciar Cotações</h2>
 <p className="text-sm text-gray-500 mt-1">Configure quais moedas e commodities aparecem na barra de topo global.</p>
 </div>
 </div>

 {/* ##### 1. INTERRUPTOR PRINCIPAL ##### */}
 <div className="bg-gray-50 hover:bg-gray-100 transition-colors p-5 rounded-xl mb-8 border border-gray-200 shadow-sm">
 <label htmlFor="show-bar-toggle" className="flex items-center justify-between cursor-pointer group">
 <div>
 <span className="text-base font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Exibir Barra de Cotações no Topo</span>
 <p className="text-xs text-gray-500 mt-1">Ao desligar, o widget rolável desaparecerá completamente para você.</p>
 </div>
 <div className="relative ml-4 shrink-0">
 <input
 type="checkbox"
 id="show-bar-toggle"
 className="sr-only peer"
 checked={showBar}
 onChange={() => setShowBar(!showBar)}
 />
 <div className="w-12 h-6 bg-gray-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-100 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
 </div>
 </label>
 </div>

 {/* A seleção de cotações só aparece se o interruptor principal estiver ligado */}
 {showBar && (
 <div className="animate-in slide-in-from-top-4 duration-300">
 <p className="mb-6 text-sm font-medium text-gray-600 border-l-4 border-blue-500 pl-3">
 Selecione abaixo quais cotações você deseja visualizar.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ minHeight: '400px', maxHeight: '600px' }}>
 <CotacaoList
 title="Moedas Fiduciárias"
 items={currencies}
 selectedItems={selectedCotacoes}
 onToggle={handleToggle}
 searchTerm={currencySearch}
 setSearchTerm={setCurrencySearch}
 />
 <CotacaoList
 title="Commodities e Grãos"
 items={commodities}
 selectedItems={selectedCotacoes}
 onToggle={handleToggle}
 searchTerm={commoditySearch}
 setSearchTerm={setCommoditySearch}
 />
 </div>
 </div>
 )}

 <div className="mt-8 flex justify-end pt-6 border-t border-gray-100">
 <button
 onClick={handleSave}
 disabled={mutation.isPending}
 className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {mutation.isPending ? (
 <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</>
 ) : (
 <><FontAwesomeIcon icon={faSave} /> Salvar Preferências</>
 )}
 </button>
 </div>
 </div>
 );
}