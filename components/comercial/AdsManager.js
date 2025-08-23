"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartBar, faBullhorn, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';

// Função para formatar moeda
const formatCurrency = (value, currency) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value || 0);
}

export default function AdsManager() {
    const { data: session, status: sessionStatus } = useSession();
    
    // Estados para os dados
    const [adAccounts, setAdAccounts] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [ads, setAds] = useState([]);

    // Estados para o que está selecionado na tela
    const [selectedAdAccountId, setSelectedAdAccountId] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');

    // Estados para controlar o carregamento
    const [loading, setLoading] = useState({ accounts: false, campaigns: false, ads: false });

    // Busca as Contas de Anúncio
    const fetchAdAccounts = useCallback(async () => {
        if (sessionStatus !== 'authenticated') return;
        setLoading(prev => ({ ...prev, accounts: true }));
        try {
            const response = await fetch('/api/meta/ad-accounts');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao buscar contas de anúncio');
            setAdAccounts(data);
            if (data.length > 0) {
                setSelectedAdAccountId(data[0].id); // Meta retorna 'id' que já inclui o 'act_'
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(prev => ({ ...prev, accounts: false }));
        }
    }, [sessionStatus]);

    useEffect(() => {
        fetchAdAccounts();
    }, [fetchAdAccounts]);

    // Busca as Campanhas quando uma conta é selecionada
    useEffect(() => {
        const fetchCampaigns = async () => {
            if (!selectedAdAccountId) {
                setCampaigns([]);
                setAds([]);
                setSelectedCampaignId('');
                return;
            };
            setLoading(prev => ({ ...prev, campaigns: true, ads: false }));
            setCampaigns([]);
            setAds([]);
            setSelectedCampaignId('');
            try {
                const response = await fetch('/api/meta/campaigns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adAccountId: selectedAdAccountId }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Falha ao buscar campanhas');
                setCampaigns(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(prev => ({ ...prev, campaigns: false }));
            }
        };
        fetchCampaigns();
    }, [selectedAdAccountId]);

    // Busca os Anúncios quando uma campanha é selecionada
    useEffect(() => {
        const fetchAds = async () => {
            if (!selectedCampaignId) {
                setAds([]);
                return;
            };
            setLoading(prev => ({ ...prev, ads: true }));
            setAds([]);
            try {
                const response = await fetch('/api/meta/ads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId: selectedCampaignId }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Falha ao buscar anúncios');
                setAds(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(prev => ({ ...prev, ads: false }));
            }
        };
        fetchAds();
    }, [selectedCampaignId]);


    if (sessionStatus === 'loading') {
        return <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Verificando autenticação...</div>;
    }

    if (sessionStatus === 'unauthenticated') {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="mb-4">Por favor, conecte sua conta da Meta para gerenciar seus anúncios.</p>
                <button onClick={() => signIn('facebook')} className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900 flex items-center gap-2 mx-auto">
                    <FontAwesomeIcon icon={faMeta} /> Conectar com a Meta
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="ad-account-select" className="block text-sm font-medium text-gray-700">Conta de Anúncios</label>
                <select id="ad-account-select" value={selectedAdAccountId} onChange={e => setSelectedAdAccountId(e.target.value)} disabled={loading.accounts} className="mt-1 block w-full md:w-1/2 p-2 border rounded-md">
                    {loading.accounts ? <option>Carregando contas...</option> : adAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_id})</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lista de Campanhas */}
                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faBullhorn} /> Campanhas</h3>
                    {loading.campaigns ? <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
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

                {/* Lista de Anúncios */}
                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faChartBar} /> Anúncios</h3>
                     {loading.ads ? <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
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