// app/(main)/comercial/anuncios/page.js

"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import FiltroAnuncios from '@/components/comercial/FiltroAnuncios';
import TabelaAnuncios from '@/components/comercial/TabelaAnuncios';
import KpiAnuncios from '@/components/comercial/KpiAnuncios'; // NOVO: Importa o componente de KPI

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

    // A requisição agora vai para a nossa API atualizada
    const response = await fetch(`/api/meta/anuncios?${params.toString()}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Não foi possível buscar os anúncios.');
    }
    return response.json();
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

    const { data: adsData, isLoading, isError, error } = useQuery({
        queryKey: ['metaAds', filters],
        queryFn: () => fetchMetaAds(filters),
        keepPreviousData: true, 
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
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Anúncios da Meta</h1>
                <p className="text-gray-600 mt-1">Monitore o desempenho e o status de suas campanhas e anúncios.</p>
            </header>

            {/* ================================================================================= */}
            {/* O PORQUÊ da alteração aqui:                                                     */}
            {/* Adicionamos o novo componente KpiAnuncios, que agora é responsável por          */}
            {/* mostrar os cartões de performance. Passamos para ele os dados dos anúncios      */}
            {/* (`adsData`) e o estado de carregamento (`isLoading`) para que ele possa         */}
            {/* exibir os KPIs ou um esqueleto de carregamento.                                 */}
            {/* ================================================================================= */}
            <KpiAnuncios data={adsData} isLoading={isLoading} />
            
            <FiltroAnuncios 
                filters={filters} 
                setFilters={setFilters}
                campaigns={campaigns}
                adsets={adsets}
            />

            <main className="bg-white rounded-lg shadow-md">
                {isLoading && !adsData && ( // Mostra o spinner principal apenas no carregamento inicial
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

                {/* A tabela agora é exibida mesmo durante o recarregamento, graças ao keepPreviousData */}
                {!isError && (
                    <TabelaAnuncios data={adsData || []} filters={filters} />
                )}
            </main>
        </div>
    );
}