// app/(main)/comercial/anuncios/page.js

"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import FiltroAnuncios from '@/components/comercial/FiltroAnuncios';
import TabelaAnuncios from '@/components/comercial/TabelaAnuncios';

// O PORQUÊ DESTA VERSÃO (PERMANENTE):
// Esta é a versão final e correta.
// 1. fetchLocalAds: Busca os dados paginados do NOSSO banco de dados, tornando o carregamento inicial super rápido.
// 2. fetchFilterOptions: Busca as opções de filtro do nosso banco, para que os menus funcionem instantaneamente.
// 3. syncMutation: Controla o botão "Sincronizar", que busca os dados da Meta em segundo plano e atualiza nosso banco.

const fetchLocalAds = async (filters, page, limit) => {
    const response = await fetch('/api/meta/anuncios/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, page, limit }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Não foi possível buscar os anúncios.');
    }
    return response.json();
};

const fetchFilterOptions = async () => {
    const response = await fetch('/api/meta/anuncios/filter-options');
    if (!response.ok) throw new Error('Falha ao carregar opções de filtro.');
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
    const [page, setPage] = useState(1);
    const limit = 20;
    const queryClient = useQueryClient();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['localAds', filters, page, limit],
        queryFn: () => fetchLocalAds(filters, page, limit),
        keepPreviousData: true,
    });

    const { data: filterOptions, isLoading: isLoadingFilters } = useQuery({
        queryKey: ['adFilterOptions'],
        queryFn: fetchFilterOptions,
        staleTime: 5 * 60 * 1000,
    });

    const syncMutation = useMutation({
        mutationFn: () => fetch('/api/meta/anuncios/sync').then(res => {
            if (!res.ok) {
                return res.json().then(err => { throw new Error(err.error || 'Erro desconhecido na sincronização') });
            }
            return res.json();
        }),
        onSuccess: (data) => {
            toast.success(data.message || 'Sincronização concluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['localAds'] });
            queryClient.invalidateQueries({ queryKey: ['adFilterOptions'] });
        },
        onError: (error) => {
            toast.error(`Erro na sincronização: ${error.message}`);
        },
    });

    const ads = data?.ads ?? [];
    const totalAds = data?.total ?? 0;
    const totalPages = Math.ceil(totalAds / limit);

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Anúncios da Meta</h1>
                    <p className="text-gray-600 mt-1">Monitore o desempenho e o status de suas campanhas e anúncios.</p>
                </div>
                <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="mt-4 md:mt-0 bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2 transition-colors"
                >
                    <FontAwesomeIcon icon={syncMutation.isPending ? faSpinner : faSyncAlt} spin={syncMutation.isPending} />
                    {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar com a Meta'}
                </button>
            </header>

            <FiltroAnuncios
                filters={filters}
                setFilters={setFilters}
                campaigns={filterOptions?.campaigns ?? []}
                adsets={filterOptions?.adsets ?? []}
                isLoadingOptions={isLoadingFilters}
            />

            <main className="bg-white rounded-lg shadow-md">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
                        <p className="mt-4 text-lg font-semibold text-gray-700">Buscando anúncios no banco de dados...</p>
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
                        <TabelaAnuncios data={ads} filters={filters} />
                        {totalAds > 0 && (
                            <div className="p-4 flex justify-between items-center text-sm text-gray-600 border-t">
                                <span>Mostrando {ads.length} de {totalAds} anúncios</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100">Anterior</button>
                                    <span>Página {page} de {totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100">Próxima</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}