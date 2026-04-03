"use client";

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLayerGroup, faExclamationTriangle, faSearch, faFilter } from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import FiltroAnuncios from './FiltroAnuncios';
import KpiAnuncios from './KpiAnuncios';
import TabelaAnuncios from './TabelaAnuncios';

const ANUNCIOS_UI_STATE_KEY = 'STUDIO57_ANUNCIOS_UI_STATE_V2';

const getCachedUiState = () => {
 if (typeof window === 'undefined') return null;
 try {
 const saved = localStorage.getItem(ANUNCIOS_UI_STATE_KEY);
 return saved ? JSON.parse(saved) : null;
 } catch (e) {
 return null;
 }
};

const fetchAdAccounts = async () => {
 const res = await fetch('/api/meta/ad-accounts');
 if (!res.ok) throw new Error('Erro ao carregar contas');
 return res.json();
};

const fetchCampaignsAndSets = async () => {
 const res = await fetch('/api/meta/campaigns');
 if (!res.ok) return { campaigns: [], adsets: [] };
 return res.json();
};

// 1. A MÁGICA AQUI: A função agora recebe as datas e manda para a nossa API
const fetchAdsData = async (startDate, endDate) => {
 const params = new URLSearchParams();
 if (startDate) params.append('startDate', startDate);
 if (endDate) params.append('endDate', endDate);

 const res = await fetch(`/api/meta/ads?${params.toString()}`);
 if (!res.ok) throw new Error('Erro ao carregar anúncios');
 return res.json();
};

const saveSelectedAccount = async (adAccountId) => {
 await fetch('/api/meta/ad-accounts', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ad_account_id: adAccountId })
 });
};

export default function AdsManager() {
 const queryClient = useQueryClient();
 const isFirstRender = useRef(true);

 const [searchTerm, setSearchTerm] = useState('');
 const [isFilterOpen, setIsFilterOpen] = useState(false);

 const [filters, setFilters] = useState({
 status: [],
 startDate: '',
 endDate: '',
 campaignIds: [],
 adsetIds: [],
 searchTerm: ''
 });

 const [debouncedSearch] = useDebounce(searchTerm, 1000);

 useEffect(() => {
 const cached = getCachedUiState();
 if (cached) {
 if (cached.searchTerm) setSearchTerm(cached.searchTerm);
 if (cached.filters) setFilters(cached.filters);
 if (cached.isFilterOpen !== undefined) setIsFilterOpen(cached.isFilterOpen);
 }
 isFirstRender.current = false;
 }, []);

 useEffect(() => {
 if (isFirstRender.current) return;

 const newFilters = { ...filters, searchTerm: debouncedSearch };
 setFilters(newFilters);

 localStorage.setItem(ANUNCIOS_UI_STATE_KEY, JSON.stringify({
 searchTerm: debouncedSearch,
 filters: newFilters,
 isFilterOpen
 }));
 }, [debouncedSearch, filters.status, filters.startDate, filters.endDate, filters.campaignIds, filters.adsetIds, isFilterOpen]);

 const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
 queryKey: ['meta-accounts'],
 queryFn: fetchAdAccounts,
 refetchOnWindowFocus: false
 });

 const { data: filterData } = useQuery({
 queryKey: ['meta-filters', accountsData?.selected_account_id],
 queryFn: fetchCampaignsAndSets,
 enabled: !!accountsData?.selected_account_id,
 });

 // 2. A MÁGICA AQUI: O React Query agora "escuta" as datas. Se a data mudar, ele busca de novo sozinho!
 const { data: adsResponse, isLoading: isLoadingAds, isError, refetch } = useQuery({
 queryKey: ['meta-ads', accountsData?.selected_account_id, filters.startDate, filters.endDate],
 queryFn: () => fetchAdsData(filters.startDate, filters.endDate),
 enabled: !!accountsData?.selected_account_id,
 });

 const mutationChangeAccount = useMutation({
 mutationFn: saveSelectedAccount,
 onSuccess: () => {
 toast.success('Conta de Anúncios alterada!');
 queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
 queryClient.invalidateQueries({ queryKey: ['meta-filters'] });
 queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
 setFilters({ status: [], startDate: '', endDate: '', campaignIds: [], adsetIds: [], searchTerm: '' });
 setSearchTerm('');
 }
 });

 if (isLoadingAccounts) return (
 <div className="flex flex-col items-center justify-center p-10 text-center min-h-[50vh]">
 <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500 mb-4" />
 <p className="text-gray-600 font-medium">Conectando ao Meta Ads...</p>
 </div>
 );

 if (!accountsData?.accounts || accountsData.accounts.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-8 text-center min-h-[50vh] animate-in fade-in zoom-in duration-300">
 <div className="bg-yellow-50/50 border border-yellow-100 rounded-2xl p-8 max-w-sm w-full mx-auto shadow-sm flex flex-col items-center">
 <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-yellow-500">
 <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl opacity-80" />
 </div>
 <h3 className="text-lg font-bold text-gray-800 mb-1">Conta não conectada</h3>
 <p className="text-sm text-gray-500 px-4">Nenhuma conta de anúncios do Meta foi vinculada a esta organização ainda.</p>
 </div>
 </div>
 );
 }

 const ads = adsResponse?.data || [];

 return (
 <div className="space-y-6">
 <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100 gap-4">
 <div className="flex items-center gap-3 w-full md:w-auto">
 <div className="bg-blue-50 p-2 rounded-lg">
 <FontAwesomeIcon icon={faMeta} className="text-blue-600 text-xl" />
 </div>
 <div className="flex flex-col">
 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Conta de Anúncios</span>
 <select
 className="bg-transparent border-none text-sm font-semibold text-gray-800 focus:ring-0 cursor-pointer outline-none -ml-1"
 value={accountsData.selected_account_id || ''}
 onChange={(e) => mutationChangeAccount.mutate(e.target.value)}
 >
 <option value="" disabled>Selecione uma conta...</option>
 {accountsData.accounts.map(acc => (
 <option key={acc.id} value={acc.id}>{acc.name}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="flex items-center gap-3 w-full md:w-auto flex-1 md:justify-end">
 <div className="relative flex-1 max-w-md w-full">
 <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
 <input
 type="text"
 placeholder="Buscar campanha, anúncio..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white focus:bg-white"
 />
 </div>
 <button
 onClick={() => setIsFilterOpen(!isFilterOpen)}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isFilterOpen || filters.status.length > 0 || filters.startDate
 ? 'bg-blue-50 text-blue-700 border border-blue-200'
 : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
 }`}
 >
 <FontAwesomeIcon icon={faFilter} />
 <span className="hidden sm:inline">Filtros Avançados</span>
 </button>
 </div>
 </div>

 {isFilterOpen && (
 <div className="animate-fade-in-down">
 <FiltroAnuncios
 filters={filters}
 setFilters={setFilters}
 campaigns={filterData?.campaigns || []}
 adsets={filterData?.adsets || []}
 refetch={refetch}
 />
 </div>
 )}

 {!accountsData.selected_account_id ? (
 <div className="flex flex-col items-center justify-center p-8 text-center min-h-[40vh] animate-in fade-in zoom-in duration-300">
 <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 max-w-sm w-full mx-auto shadow-sm flex flex-col items-center">
 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-500">
 <FontAwesomeIcon icon={faMeta} className="text-3xl opacity-80" />
 </div>
 <h3 className="text-lg font-bold text-gray-800 mb-1">Selecione uma Conta</h3>
 <p className="text-sm text-gray-500 px-4">Por favor, selecione uma conta de anúncios no menu acima para carregar o histórico.</p>
 </div>
 </div>
 ) : (
 <>
 <KpiAnuncios data={ads} isLoading={isLoadingAds} />

 <main className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
 <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
 <h3 className="font-bold text-gray-800 flex items-center gap-2">
 <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400" />
 Lista de Anúncios
 </h3>
 <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
 {ads.length} criativos
 </span>
 </div>

 {isLoadingAds ? (
 <div className="flex flex-col items-center justify-center p-20 text-center min-h-[30vh]">
 <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500 mb-4" />
 <p className="text-gray-600 font-medium">Buscando dados do Meta...</p>
 </div>
 ) : isError ? (
 <div className="flex flex-col items-center justify-center p-16 text-center min-h-[30vh] bg-red-50/30">
 <div className="bg-red-50 border border-red-100 rounded-2xl p-8 max-w-sm w-full mx-auto shadow-sm flex flex-col items-center">
 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
 <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl opacity-80" />
 </div>
 <h3 className="text-lg font-bold text-gray-800 mb-1">Erro de Conexão</h3>
 <p className="text-red-600 text-sm px-2">Não foi possível carregar os dados desta conta do Meta Ads.</p>
 </div>
 </div>
 ) : (
 <TabelaAnuncios ads={ads} filters={filters} />
 )}
 </main>
 </>
 )}
 </div>
 );
}