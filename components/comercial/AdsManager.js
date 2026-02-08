// components/comercial/AdsManager.js
"use client";

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartBar, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth

// Função para formatar moeda
const formatCurrency = (value, currency) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value || 0);
}

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organização_id)
// O PORQUÊ: Todas as funções de busca agora recebem e enviam o `organizacaoId`
// para a nossa API interna. Isso permite que o backend saiba qual conta da Meta
// (e qual token de acesso) deve ser usado para a requisição, garantindo que os
// dados de uma organização não se misturem com os de outra.
// =================================================================================

// 1. Busca as Contas de Anúncio
const fetchAdAccounts = async (organizacaoId) => {
    if (!organizacaoId) return [];
    const response = await fetch('/api/meta/ad-accounts', { // Alterado para POST para enviar o ID
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizacaoId }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar contas de anúncio');
    }
    return response.json();
};

// 2. Busca as Campanhas de uma conta específica
const fetchCampaigns = async (adAccountId, organizacaoId) => {
    if (!adAccountId || !organizacaoId) return [];
    const response = await fetch('/api/meta/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId, organizacaoId }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar campanhas');
    }
    return response.json();
};

// 3. Busca os Anúncios de uma campanha específica
const fetchAds = async (campaignId, organizacaoId) => {
    if (!campaignId || !organizacaoId) return [];
    const response = await fetch('/api/meta/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, organizacaoId }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar anúncios');
    }
    return response.json();
};


export default function AdsManager() {
    const { data: session, status: sessionStatus } = useSession();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    console.log("Status da Sessão:", sessionStatus, "Dados da Sessão:", session);

    const [selectedAdAccountId, setSelectedAdAccountId] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (queryKey e queryFn)
    // O PORQUÊ: Adicionamos `organizacaoId` à `queryKey` e o passamos para a função
    // de busca (`queryFn`), além de garantir que a busca só ocorra (`enabled`)
    // quando tivermos todas as informações necessárias.
    // =================================================================================
    const { data: adAccounts = [], isLoading: isLoadingAccounts, isError: isErrorAccounts, error: errorAccounts } = useQuery({
        queryKey: ['adAccounts', organizacaoId],
        queryFn: () => fetchAdAccounts(organizacaoId),
        enabled: sessionStatus === 'authenticated' && !!organizacaoId,
        onSuccess: (data) => {
            if (!selectedAdAccountId && data && data.length > 0) {
                setSelectedAdAccountId(data[0].id);
            }
        },
    });

    const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
        queryKey: ['campaigns', selectedAdAccountId, organizacaoId],
        queryFn: () => fetchCampaigns(selectedAdAccountId, organizacaoId),
        enabled: !!selectedAdAccountId && !!organizacaoId,
    });

    const { data: ads = [], isLoading: isLoadingAds } = useQuery({
        queryKey: ['ads', selectedCampaignId, organizacaoId],
        queryFn: () => fetchAds(selectedCampaignId, organizacaoId),
        enabled: !!selectedCampaignId && !!organizacaoId,
    });


    if (sessionStatus === 'loading') {
        return <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Verificando autenticação...</div>;
    }

    if (sessionStatus === 'unauthenticated' || (session && session.error === 'RefreshAccessTokenError')) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="mb-4">Por favor, conecte sua conta da Meta para gerenciar seus anúncios.</p>
                {session && session.error === 'RefreshAccessTokenError' && <p className="text-red-500 mb-4">Sua sessão expirou. Por favor, conecte-se novamente.</p>}
                
                <button onClick={() => signIn('facebook', { callbackUrl: '/comercial/anuncios' })} className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900 flex items-center gap-2 mx-auto">
                    <FontAwesomeIcon icon={faMeta} /> Conectar com a Meta
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="ad-account-select" className="block text-sm font-medium text-gray-700">Conta de Anúncios</label>
                <select 
                    id="ad-account-select" 
                    value={selectedAdAccountId} 
                    onChange={e => {
                        setSelectedAdAccountId(e.target.value);
                        setSelectedCampaignId(''); 
                    }} 
                    disabled={isLoadingAccounts} 
                    className="mt-1 block w-full md:w-1/2 p-2 border rounded-md"
                >
                    {isLoadingAccounts ? <option>Carregando contas...</option> : 
                     isErrorAccounts ? <option>Erro ao carregar contas</option> :
                     adAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_id})</option>
                    ))}
                </select>
                {isErrorAccounts && <p className="text-red-500 text-sm mt-1">{errorAccounts.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faBullhorn} /> Campanhas</h3>
                    {isLoadingCampaigns ? <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {campaigns.map(camp => (
                                <li key={camp.id} onClick={() => setSelectedCampaignId(camp.id)} className={`p-2 rounded-md cursor-pointer ${selectedCampaignId === camp.id ? 'bg-blue-100 ring-2 ring-blue-300' : 'hover:bg-gray-100'}`}>
                                    <p className="font-medium">{camp.name}</p>
                                    <p className="text-xs text-gray-500">{camp.objective} - <span className={camp.status === 'ACTIVE' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{camp.status}</span></p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faChartBar} /> Anúncios</h3>
                     {isLoadingAds ? <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                           {ads.length > 0 ? ads.map(ad => (
                               <div key={ad.id} className="p-2 border-b">
                                   <p className="font-medium">{ad.name}</p>
                                   <div className="grid grid-cols-2 md:grid-cols-4 text-xs text-gray-600 mt-1">
                                       <span>Gasto: {formatCurrency(ad.insights.spend, adAccounts.find(acc => acc.id === selectedAdAccountId)?.currency)}</span>
                                       <span>Cliques: {ad.insights.clicks || 0}</span>
                                       <span>Impr.: {ad.insights.impressions || 0}</span>
                                       <span>CPC: {formatCurrency(ad.insights.cpc, adAccounts.find(acc => acc.id === selectedAdAccountId)?.currency)}</span>
                                   </div>
                               </div>
                           )) : <p className="text-sm text-gray-500 text-center pt-4">Selecione uma campanha para ver os anúncios.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}