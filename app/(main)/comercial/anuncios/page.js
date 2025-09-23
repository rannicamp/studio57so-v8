// app/(main)/comercial/anuncios/page.js

"use client";

import { useState, useMemo } from 'react';
// ALTERADO: Trocamos useQuery por useInfiniteQuery, a ferramenta certa para paginação.
import { useInfiniteQuery } from '@tanstack/react-query'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import FiltroAnuncios from '@/components/comercial/FiltroAnuncios';
import TabelaAnuncios from '@/components/comercial/TabelaAnuncios';

// ALTERADO: A função agora aceita um 'pageParam' (nosso cursor) para buscar páginas específicas.
const fetchMetaAds = async (filters, pageParam = '') => {
    const params = new URLSearchParams();
    if (filters.status && filters.status.length > 0) params.append('status', filters.status.join(','));
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.campaignIds && filters.campaignIds.length > 0) params.append('campaign_ids', filters.campaignIds.join(','));
    if (filters.adsetIds && filters.adsetIds.length > 0) params.append('adset_ids', filters.adsetIds.join(','));
    
    // Adiciona o cursor para buscar a próxima página
    if (pageParam) {
        params.append('cursor', pageParam);
    }

    const response = await fetch(`/api/meta/anuncios?${params.toString()}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Não foi possível buscar os anúncios.');
    }
    return response.json(); // A API agora retorna { ads: [], nextPageCursor: '...' }
};

const initialFilterState = {
    searchTerm: '',
    status: [],
    startDate: '',
    endDate: '',
    campaignIds: [],
    adsetIds: [],
};

export default function AnunciosPage() {
    const [filters, setFilters] = useState(initialFilterState);

    // =================================================================================
    // ALTERADO: Trocamos useQuery por useInfiniteQuery
    // O PORQUÊ: Esta ferramenta gerencia múltiplas "páginas" de dados para nós.
    // - queryKey: Identifica a busca. Inclui os filtros para que a busca seja refeita quando eles mudam.
    // - queryFn: A função que busca os dados. Passamos o pageParam (cursor) para ela.
    // - getNextPageParam: Ensina a ferramenta como encontrar o cursor da próxima página na resposta da API.
    // =================================================================================
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isLoading,
        isError,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['metaAds', filters],
        queryFn: ({ pageParam }) => fetchMetaAds(filters, pageParam),
        getNextPageParam: (lastPage) => lastPage.nextPageCursor, // Pega o cursor para a próxima página
    });

    // O useInfiniteQuery retorna os dados em `data.pages`, um array de páginas.
    // Nós "achatamos" esse array para criar uma lista única com todos os anúncios de todas as páginas.
    const allAds = useMemo(() => data?.pages.flatMap(page => page.ads) ?? [], [data]);

    // Lógica para extrair campanhas e conjuntos para os filtros (sem alterações, mas agora usa allAds)
    const { campaigns, adsets } = useMemo(() => {
        if (!allAds) return { campaigns: [], adsets: [] };
        const campaignMap = new Map();
        const adsetMap = new Map();
        allAds.forEach(ad => {
            if (ad.campaign_id && ad.campaign_name && !campaignMap.has(ad.campaign_id)) {
                campaignMap.set(ad.campaign_id, { id: ad.campaign_id, nome: ad.campaign_name });
            }
            if (ad.adset_id && ad.adset_name && !adsetMap.has(ad.adset_id)) {
                adsetMap.set(ad.adset_id, { id: ad.adset_id, nome: ad.adset_name });
            }
        });
        return { campaigns: Array.from(campaignMap.values()), adsets: Array.from(adsetMap.values()) };
    }, [allAds]);

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Anúncios da Meta</h1>
                <p className="text-gray-600 mt-1">Monitore o desempenho e o status de suas campanhas e anúncios.</p>
            </header>

            <FiltroAnuncios 
                filters={filters} 
                setFilters={setFilters}
                campaigns={campaigns}
                adsets={adsets}
            />

            <main className="bg-white rounded-lg shadow-md">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
                        <p className="mt-4 text-lg font-semibold text-gray-700">Buscando anúncios...</p>
                    </div>
                )}

                {isError && (
                    <div className="flex flex-col items-center justify-center text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                        <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-500" />
                        <p className="mt-4 text-lg font-semibold text-red-700">Ocorreu um Erro</p>
                        <p className="text-red-600">{error.message}</p>
                    </div>
                )}

                {!isLoading && !isError && (
                    <>
                        <TabelaAnuncios data={allAds} filters={filters} />
                        {/* ================================================================================= */}
                        {/* NOVO: Botão "Carregar Mais" */}
                        {/* O PORQUÊ: Este botão aparece se houver uma próxima página (hasNextPage). */}
                        {/* Ao clicar, ele chama fetchNextPage() para buscar e adicionar mais anúncios à lista. */}
                        {/* ================================================================================= */}
                        <div className="p-4 flex justify-center">
                            {hasNextPage && (
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
                                >
                                    {isFetchingNextPage
                                        ? 'Carregando mais...'
                                        : 'Carregar Mais Anúncios'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}