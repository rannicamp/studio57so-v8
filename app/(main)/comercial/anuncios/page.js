// app/(main)/comercial/anuncios/page.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faBullhorn, faChartLine, faDollarSign } from '@fortawesome/free-solid-svg-icons';
// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: Trocamos o caminho relativo ('../../../components/KpiCard') por um
// caminho absoluto com atalho ('@/components/KpiCard'). Isso é mais robusto
// e evita que o sistema se perca ao procurar o arquivo.
// =================================================================================
import KpiCard from '@/components/KpiCard';
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================

const fetchActiveAds = async () => {
    const response = await fetch('/api/meta/anuncios');
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar anúncios.');
    }
    return response.json();
};

const AdCard = ({ ad }) => {
    const adCreative = ad.adcreatives?.data[0];
    const adInsight = ad.insights?.data[0];
    const imageUrl = adCreative?.thumbnail_url || adCreative?.image_url || 'https://placehold.co/1600x900?text=Sem+Imagem';

    return (
        <div className="bg-white border rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
            <img src={imageUrl} alt={`Criativo para ${ad.name}`} className="w-full h-48 object-cover" />
            <div className="p-4">
                <h3 className="font-bold text-gray-800 truncate" title={ad.name}>{ad.name}</h3>
                <div className="mt-2 flex justify-between items-center text-sm">
                    <span className="px-2 py-1 bg-green-100 text-green-800 font-semibold rounded-full">
                        {ad.status}
                    </span>
                    <span className="font-semibold text-gray-700">
                        Gasto: R$ {parseFloat(adInsight?.spend || 0).toFixed(2).replace('.', ',')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default function AnunciosPage() {
    const { data: ads = [], error, isLoading } = useQuery({
        queryKey: ['activeMetaAds'],
        queryFn: fetchActiveAds,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const totalSpend = ads.reduce((acc, ad) => acc + parseFloat(ad.insights?.data[0]?.spend || 0), 0);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Gerenciador de Anúncios da Meta</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard title="Total de Anúncios Ativos" value={isLoading ? '...' : ads.length} icon={faBullhorn} color="blue" />
                <KpiCard title="Valor Total Gasto" value={isLoading ? '...' : `R$ ${totalSpend.toFixed(2).replace('.', ',')}`} icon={faDollarSign} color="green" />
                <KpiCard title="Status da API" value={error ? 'Erro' : 'Operacional'} icon={error ? faExclamationTriangle : faChartLine} color={error ? 'red' : 'purple'} />
            </div>

            {isLoading && (
                <div className="text-center py-16">
                    <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
                    <p className="mt-4 font-semibold text-gray-600">Buscando anúncios ativos na Meta...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                Ocorreu um erro ao buscar os dados da Meta: <span className="font-semibold">{error.message}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!isLoading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {ads.map(ad => (
                        <AdCard key={ad.id} ad={ad} />
                    ))}
                </div>
            )}
            
            {!isLoading && ads.length === 0 && !error && (
                <p className="text-center py-16 text-gray-500">Nenhum anúncio ativo encontrado.</p>
            )}
        </div>
    );
}