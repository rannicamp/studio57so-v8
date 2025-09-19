// app/(main)/comercial/anuncios/page.js

"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import FiltroAnuncios from '@/components/comercial/FiltroAnuncios';
import TabelaAnuncios from '@/components/comercial/TabelaAnuncios';

const fetchMetaAds = async (filters) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
    }
    // Adicionamos as datas aos parâmetros que enviamos para a API
    if (filters.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
        params.append('endDate', filters.endDate);
    }

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
};

export default function AnunciosPage() {
    const [filters, setFilters] = useState(initialFilterState);

    const { data: adsData, isLoading, isError, error } = useQuery({
        queryKey: ['metaAds', filters],
        queryFn: () => fetchMetaAds(filters),
    });

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Anúncios da Meta</h1>
                <p className="text-gray-600 mt-1">Monitore o desempenho e o status de suas campanhas e anúncios.</p>
            </header>

            <FiltroAnuncios filters={filters} setFilters={setFilters} />

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
                    <TabelaAnuncios data={adsData || []} filters={filters} />
                )}
            </main>
        </div>
    );
}