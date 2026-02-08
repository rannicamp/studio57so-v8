// app/(main)/comercial/anuncios/page.js

"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faSearch, faFilter } from '@fortawesome/free-solid-svg-icons';
import { useDebounce } from 'use-debounce';

import FiltroAnuncios from '@/components/comercial/FiltroAnuncios';
import TabelaAnuncios from '@/components/comercial/TabelaAnuncios';
import KpiAnuncios from '@/components/comercial/KpiAnuncios';

const ANUNCIOS_UI_STATE_KEY = 'STUDIO57_ANUNCIOS_UI_STATE_V1';

const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(ANUNCIOS_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

const fetchMetaAds = async (filters) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
    }
    if (filters.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
        params.append('endDate', filters.endDate);
    }
    if (filters.campaignIds && filters.campaignIds.length > 0) {
        params.append('campaign_ids', filters.campaignIds.join(','));
    }
    if (filters.adsetIds && filters.adsetIds.length > 0) {
        params.append('adset_ids', filters.adsetIds.join(','));
    }

    const response = await fetch(`/api/meta/anuncios?${params.toString()}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Não foi possível buscar os anúncios.');
    }
    return response.json();
};

export default function AnunciosPage() {
    // --- ESTADO COM PERSISTÊNCIA ---
    const cachedState = getCachedUiState();
    
    const initialFilterState = {
        searchTerm: '',
        status: [],
        startDate: '',
        endDate: '',
        campaignIds: [],
        adsetIds: [],
    };

    const [filters, setFilters] = useState(cachedState?.filters || initialFilterState);
    const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);
    
    const [debouncedFilters] = useDebounce(filters, 500);

    // Salvar estado ao alterar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stateToSave = { filters, showFilters };
            localStorage.setItem(ANUNCIOS_UI_STATE_KEY, JSON.stringify(stateToSave));
        }
    }, [filters, showFilters]);

    // Usamos debouncedFilters para a query da API (exceto searchTerm que é client-side na tabela)
    const { data: adsData, isLoading, isError, error } = useQuery({
        queryKey: ['metaAds', { ...debouncedFilters, searchTerm: '' }], // Remove searchTerm da query key da API se for filtrar no cliente
        queryFn: () => fetchMetaAds(debouncedFilters),
        keepPreviousData: true, 
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });

    const { campaigns, adsets } = useMemo(() => {
        if (!adsData) return { campaigns: [], adsets: [] };

        const campaignMap = new Map();
        const adsetMap = new Map();

        adsData.forEach(ad => {
            if (ad.campaign_id && ad.campaign_name && !campaignMap.has(ad.campaign_id)) {
                campaignMap.set(ad.campaign_id, { id: ad.campaign_id, nome: ad.campaign_name });
            }
            if (ad.adset_id && ad.adset_name && !adsetMap.has(ad.adset_id)) {
                adsetMap.set(ad.adset_id, { id: ad.adset_id, nome: ad.adset_name });
            }
        });

        return {
            campaigns: Array.from(campaignMap.values()),
            adsets: Array.from(adsetMap.values()),
        };
    }, [adsData]);

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
            
            {/* CABEÇALHO UNIFICADO */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-800 uppercase">Anúncios Meta Ads</h1>
                    <p className="text-xs text-gray-500">Monitore o desempenho de suas campanhas em tempo real.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {/* Busca Global */}
                    <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar anúncio, campanha..." 
                            value={filters.searchTerm} 
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        />
                    </div>

                    {/* Botão Filtros */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        title="Filtros Avançados"
                    >
                        <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} />
                        Filtros
                    </button>
                </div>
            </div>

            {/* Painel de Filtros (AGORA ACIMA DOS KPIS) */}
            {showFilters && (
                <FiltroAnuncios 
                    filters={filters} 
                    setFilters={setFilters}
                    campaigns={campaigns}
                    adsets={adsets}
                />
            )}

            {/* KPIs */}
            <KpiAnuncios data={adsData} isLoading={isLoading} />
            
            {/* Tabela de Dados */}
            <main className="bg-white rounded-lg shadow-md overflow-hidden">
                {isLoading && !adsData && (
                    <div className="flex flex-col items-center justify-center text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
                        <p className="mt-4 text-lg font-semibold text-gray-700">Carregando dados do Meta...</p>
                    </div>
                )}

                {isError && (
                    <div className="flex flex-col items-center justify-center text-center p-10 bg-red-50">
                        <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-500" />
                        <p className="mt-4 text-lg font-semibold text-red-700">Erro de Conexão</p>
                        <p className="text-red-600 max-w-md">{error.message}</p>
                    </div>
                )}

                {!isError && (
                    <TabelaAnuncios data={adsData || []} filters={filters} />
                )}
            </main>
        </div>
    );
}